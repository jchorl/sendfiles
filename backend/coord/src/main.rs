mod errors;
mod message;
mod request;
mod response;

use bytes::Bytes;
use chrono::{DateTime, Duration, Utc};
use dynomite::{
    dynamodb::{DynamoDb, DynamoDbClient, GetItemInput, PutItemInput},
    retry::Policy,
    FromAttributes, Item, Retries,
};
use lambda::{lambda, Context};
use rusoto_apigatewaymanagementapi::{
    ApiGatewayManagementApi, ApiGatewayManagementApiClient, PostToConnectionRequest,
};
use rusoto_core::Region;

#[lambda]
#[tokio::main]
async fn main(
    request: request::LambdaWebsocketRequest,
    _: Context,
) -> Result<response::LambdaWebsocketResponse, errors::Error> {
    let api = Api {
        db_client: Box::new(DynamoDbClient::new(Region::default()).with_retries(Policy::default())),
        gw_client: Box::new(ApiGatewayManagementApiClient::new(Region::Custom {
            name: Region::default().name().to_string(),
            endpoint: format!(
                "{}/{}",
                request.request_context.domain_name, request.request_context.stage
            ),
        })),
        offers_table: "OffersTest".to_string(),
    };

    match request.request_context.route_key.as_str() {
        "$connect" => api.connect(request).await,
        "$disconnect" => api.disconnect(request).await,
        _ => Err(Box::new(errors::BadRequestError {})),
    }
}

#[derive(Item, Clone)]
struct Offer {
    #[dynomite(partition_key)]
    transfer_id: String,
    api_gateway_connection_id: String,
    valid_until: DateTime<Utc>,
}

struct Api {
    db_client: Box<dyn DynamoDb + Send + Sync>,
    gw_client: Box<dyn ApiGatewayManagementApi + Send + Sync>,
    offers_table: String,
}

impl Api {
    async fn connect(
        &self,
        request: request::LambdaWebsocketRequest,
    ) -> Result<response::LambdaWebsocketResponse, errors::Error> {
        let connect_req = request::ConnectRequest::parse_from(&request)?;

        match connect_req.role {
            request::Role::Offerer => {
                self.add_offer(
                    connect_req.transfer_id,
                    request.request_context.connection_id,
                )
                .await?;
            }
            request::Role::Receiver => {
                self.send_offerer_new_receiver(
                    connect_req.transfer_id,
                    request.request_context.connection_id,
                )
                .await?;
            }
            _ => {}
        }
        Ok(Default::default())
    }

    async fn disconnect(
        &self,
        _request: request::LambdaWebsocketRequest,
    ) -> Result<response::LambdaWebsocketResponse, errors::Error> {
        // for now, this is a no-op
        Ok(Default::default())
    }

    async fn add_offer(
        &self,
        transfer_id: String,
        api_gateway_connection_id: String,
    ) -> Result<(), errors::Error> {
        let offer = Offer {
            transfer_id: transfer_id,
            api_gateway_connection_id: api_gateway_connection_id,
            valid_until: Utc::now() + Duration::minutes(15),
        };

        let input = PutItemInput {
            table_name: self.offers_table.clone(),
            item: offer.clone().into(),
            ..PutItemInput::default()
        };

        self.db_client.put_item(input).await?;
        Ok(())
    }

    async fn send_offerer_new_receiver(
        &self,
        transfer_id: String,
        api_gateway_connection_id: String,
    ) -> Result<(), errors::Error> {
        let offer_key = OfferKey {
            transfer_id: transfer_id,
        };
        let result = self
            .db_client
            .get_item(GetItemInput {
                table_name: self.offers_table.clone(),
                key: offer_key.into(),
                ..GetItemInput::default()
            })
            .await?;
        let offer = Offer::from_attrs(result.item.unwrap())?;

        let message = message::Message {
            sender: api_gateway_connection_id,
            recipient: offer.api_gateway_connection_id.clone(),
            message_type: message::Type::NewRecipient,
            body: None,
        };
        let message_encoded = serde_json::to_string(&message)?;
        self.gw_client
            .post_to_connection(PostToConnectionRequest {
                connection_id: offer.api_gateway_connection_id,
                data: Bytes::from(message_encoded),
                ..PostToConnectionRequest::default()
            })
            .await?;
        Ok(())
    }
}
