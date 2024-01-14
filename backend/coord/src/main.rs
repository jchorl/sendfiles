mod message;
mod offer;
mod request;

use aws_config::BehaviorVersion;
use aws_lambda_events::apigw::{ApiGatewayProxyResponse, ApiGatewayWebsocketProxyRequest};
use aws_sdk_apigatewaymanagement::primitives::Blob;
use aws_sdk_dynamodb::types::AttributeValue;
use chrono::{Duration, Utc};
use lambda_runtime::service_fn;
use lambda_runtime::{Error, LambdaEvent};
use log::error;
use serde_json::json;

struct Api {
    dynamodb_client: aws_sdk_dynamodb::client::Client,
    apigw_client: aws_sdk_apigatewaymanagement::client::Client,
    offers_table: String,
}

impl Api {
    async fn handler(
        &self,
        event: LambdaEvent<ApiGatewayWebsocketProxyRequest>,
    ) -> Result<ApiGatewayProxyResponse, Error> {
        match event
            .payload
            .request_context
            .route_key
            .to_owned()
            .ok_or("no route key in request")?
            .as_str()
        {
            "$connect" => self.connect(event.payload).await,
            "$disconnect" => self.disconnect(event.payload).await,
            "SEND_MESSAGE" => self.send_message(event.payload).await,
            _ => Err(format!(
                "unrecognized route key: {:?}",
                event.payload.request_context.route_key
            )
            .into()),
        }
    }

    async fn connect(
        &self,
        request: ApiGatewayWebsocketProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, Error> {
        let connect_req: request::ConnectRequest =
            (&request).try_into().map_err(|_| "parsing request")?;

        match connect_req.role {
            request::Role::Offerer => {
                self.add_offer(
                    connect_req.transfer_id,
                    request
                        .request_context
                        .connection_id
                        .ok_or("no connection_id found")?,
                )
                .await?;
            }
            request::Role::Receiver => {
                self.send_offerer_new_receiver(
                    connect_req.transfer_id,
                    request
                        .request_context
                        .connection_id
                        .ok_or("no connection_id found")?,
                )
                .await?;
            }
            _ => {}
        }
        Ok(ApiGatewayProxyResponse {
            status_code: 200,
            ..Default::default()
        })
    }

    async fn disconnect(
        &self,
        _request: ApiGatewayWebsocketProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, Error> {
        // for now, this is a no-op
        Ok(ApiGatewayProxyResponse {
            status_code: 200,
            ..Default::default()
        })
    }

    async fn send_message(
        &self,
        request: ApiGatewayWebsocketProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, Error> {
        let message_in: message::MessageIn =
            serde_json::from_str(request.body.ok_or("no body provided")?.as_ref())?;
        let message_out = message::MessageOut {
            sender: request
                .request_context
                .connection_id
                .ok_or("no connection id")?,
            recipient: message_in.recipient,
            body: message_in.body,
        };

        self.apigw_client
            .post_to_connection()
            .connection_id(&message_out.recipient)
            .data(Blob::new(serde_json::to_string(&message_out)?))
            .send()
            .await?;

        Ok(ApiGatewayProxyResponse {
            status_code: 200,
            ..Default::default()
        })
    }

    async fn add_offer(
        &self,
        transfer_id: String,
        api_gateway_connection_id: String,
    ) -> Result<(), Error> {
        let offer = offer::Offer {
            transfer_id,
            api_gateway_connection_id,
            valid_until: Utc::now() + Duration::hours(1),
        };

        self.dynamodb_client
            .put_item()
            .table_name(self.offers_table.clone())
            .item("transfer_id", AttributeValue::S(offer.transfer_id))
            .item(
                "api_gateway_connection_id",
                AttributeValue::S(offer.api_gateway_connection_id),
            )
            .item(
                "valid_until",
                AttributeValue::N(offer.valid_until.timestamp().to_string()),
            )
            .send()
            .await?;

        Ok(())
    }

    async fn send_offerer_new_receiver(
        &self,
        transfer_id: String,
        api_gateway_connection_id: String,
    ) -> Result<(), Error> {
        let result = self
            .dynamodb_client
            .get_item()
            .table_name(self.offers_table.clone())
            .key("transfer_id", AttributeValue::S(transfer_id))
            .send()
            .await
            .map_err(|e| format!("querying dynamo: {:?}", e))?;
        let hm = result.item.ok_or("no offer found")?;
        let offer: offer::Offer = (&hm)
            .try_into()
            .map_err(|_| "parsing offer from dynamodb")?;

        let message = message::MessageOut {
            sender: api_gateway_connection_id,
            recipient: offer.api_gateway_connection_id.clone(),
            body: json!({"type": "NEW_RECIPIENT"}).to_string(),
        };
        let message_encoded = serde_json::to_string(&message)?;
        self.apigw_client
            .post_to_connection()
            .connection_id(offer.api_gateway_connection_id)
            .data(Blob::new(message_encoded))
            .send()
            .await
            .map_err(|e| format!("post_to_connection: {:?}", e))?;
        Ok(())
    }
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    env_logger::init();

    let config = aws_config::load_defaults(BehaviorVersion::latest()).await;
    let dynamodb_client = aws_sdk_dynamodb::Client::new(&config);

    let apigw_endpoint_url = std::env::var("SENDFILES_API_GATEWAY_URL")
        .map_err(|e| format!("getting api gateway url: {:?}", e))?;

    let api_management_config = config
        .clone()
        .to_builder()
        .endpoint_url(apigw_endpoint_url)
        .build();
    let apigw_client = aws_sdk_apigatewaymanagement::Client::new(&api_management_config);

    let api = Api {
        dynamodb_client,
        apigw_client,
        offers_table: "Offers".to_string(),
    };

    lambda_runtime::run(service_fn(
        |request: LambdaEvent<ApiGatewayWebsocketProxyRequest>| async {
            let resp = api.handler(request).await;
            if let Err(ref e) = resp {
                error!("err={:?}", e);
            }
            resp
        },
    ))
    .await?;

    Ok(())
}
