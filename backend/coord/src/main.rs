mod errors;
mod request;
mod response;

use chrono::{DateTime, Duration, Utc};
use dynomite::{
    dynamodb::{DynamoDb, DynamoDbClient, PutItemInput},
    retry::Policy,
    Item, Retries,
};
use lambda::{lambda, Context};
use rusoto_core::Region;

#[lambda]
#[tokio::main]
async fn main(
    request: request::LambdaWebsocketRequest,
    _: Context,
) -> Result<response::LambdaWebsocketResponse, errors::Error> {
    let api = Api {
        db_client: Box::new(DynamoDbClient::new(Region::UsWest2).with_retries(Policy::default())),
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
        // TODO (this)
        Ok(())
    }
}
