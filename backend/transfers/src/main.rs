mod transfer_details;

use aws_config::BehaviorVersion;
use aws_sdk_dynamodb::types::AttributeValue;
use base64::{engine::general_purpose::URL_SAFE, Engine as _};
use lambda_http::{http::Method, http::StatusCode, Request, RequestExt, Response};
use lambda_http::{service_fn, Error};
use log::error;
use uuid::Uuid;

struct Api {
    dynamodb_client: aws_sdk_dynamodb::client::Client,
    transfers_table: String,
}

impl Api {
    async fn post_transfer_handler(&self, request: Request) -> Result<Response<String>, Error> {
        let body = request.into_body();
        let mut details: transfer_details::TransferDetails = serde_json::from_slice(body.as_ref())?;
        details.id = URL_SAFE.encode(Uuid::new_v4().as_bytes());

        let dynamodb_request = self
            .dynamodb_client
            .put_item()
            .table_name(self.transfers_table.to_owned())
            .item("id", AttributeValue::S(details.id))
            .item("file_name", AttributeValue::S(details.file_name))
            .item(
                "content_length_bytes",
                AttributeValue::N(details.content_length_bytes.to_string()),
            )
            .item("private_key", AttributeValue::S(details.private_key))
            .item(
                "valid_until",
                AttributeValue::N(details.valid_until.timestamp().to_string()),
            );

        let resp = match dynamodb_request.send().await {
            Ok(result) => transfer_details::TransferDetails::try_from(
                result
                    .attributes()
                    .ok_or("no attributes in dynamodb response")?,
            )
            .map_err(|e| format!("parsing transfer details from dynamodb: {:?}", e)),
            Err(e) => {
                error!("writing to db: {}", e);
                return Ok(Response::builder()
                    .status(StatusCode::INTERNAL_SERVER_ERROR)
                    .body("error saving transfer".to_string())?);
            }
        };

        Ok(Response::new(serde_json::to_string(&resp)?))
    }

    async fn get_transfer_handler(&self, request: Request) -> Result<Response<String>, Error> {
        let details_id = match request
            .query_string_parameters_ref()
            .and_then(|params| params.first("id"))
        {
            Some(id) => id.to_owned(),
            None => {
                return Ok(Response::builder()
                    .status(StatusCode::BAD_REQUEST)
                    .body("id query paramater must be passed".to_owned())?)
            }
        };

        let dynamodb_request = self
            .dynamodb_client
            .get_item()
            .table_name(self.transfers_table.to_owned())
            .key("id", AttributeValue::S(details_id));

        let details = match dynamodb_request.send().await {
            Ok(resp) => match resp.item() {
                Some(hm) => transfer_details::TransferDetails::try_from(hm)
                    .map_err(|e| format!("parsing transfer details from dynamodb: {:?}", e)),
                None => {
                    return Ok(Response::builder()
                        .status(404)
                        .body("transfer not found".to_string())?)
                }
            },
            Err(e) => {
                error!("error getting details from db: {}", e);
                return Ok(Response::builder()
                    .status(404)
                    .body("transfer not found".to_string())?);
            }
        };

        let resp = serde_json::to_string(&details)?;
        Ok(Response::new(resp))
    }

    fn not_found(&self, _request: Request) -> Result<Response<String>, Error> {
        Ok(Response::builder()
            .status(404)
            .body("route not found".to_string())?)
    }
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let config = aws_config::load_defaults(BehaviorVersion::latest()).await;
    let client = aws_sdk_dynamodb::Client::new(&config);

    let api = Api {
        dynamodb_client: client,
        transfers_table: "Transfers".to_string(),
    };

    lambda_http::run(service_fn(|request: Request| async {
        match *request.method() {
            Method::POST => api.post_transfer_handler(request).await,
            Method::GET => api.get_transfer_handler(request).await,
            _ => api.not_found(request),
        }
    }))
    .await?;

    Ok(())
}
