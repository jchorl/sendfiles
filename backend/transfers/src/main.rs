use aws_config::BehaviorVersion;
use aws_sdk_dynamodb as dynamodb;
use chrono::{DateTime, Utc};
use dynamodb::types::AttributeValue;
use http::method::Method;
use lambda_http::{http::StatusCode, Request, RequestExt, Response};
use lambda_http::{service_fn, Error};
use log::error;
use serde_derive::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

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

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TransferDetails {
    #[serde(skip_deserializing)]
    id: String,
    file_name: String,
    content_length_bytes: u32,
    private_key: String,
    valid_until: DateTime<Utc>,
}

impl From<&HashMap<String, AttributeValue>> for TransferDetails {
    fn from(value: &HashMap<String, AttributeValue>) -> Self {
        TransferDetails {
            id: value.get("id").unwrap().as_s().unwrap().to_owned(),
            file_name: value.get("file_name").unwrap().as_s().unwrap().to_owned(),
            content_length_bytes: value
                .get("content_length_bytes")
                .unwrap()
                .as_n()
                .unwrap()
                .parse::<u32>()
                .unwrap(),
            private_key: value.get("private_key").unwrap().as_s().unwrap().to_owned(),
            valid_until: DateTime::<Utc>::from_timestamp(
                value
                    .get("valid_until")
                    .unwrap()
                    .as_n()
                    .unwrap()
                    .parse::<i64>()
                    .unwrap(),
                0,
            )
            .unwrap(),
        }
    }
}

struct Api {
    dynamodb_client: aws_sdk_dynamodb::client::Client,
    transfers_table: String,
}

impl Api {
    async fn post_transfer_handler(&self, request: Request) -> Result<Response<String>, Error> {
        let body = request.into_body();
        let mut details: TransferDetails = serde_json::from_slice(body.as_ref())?;
        details.id = Uuid::new_v4().as_hyphenated().to_string();

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
            Ok(result) => TransferDetails::from(result.attributes().unwrap()),
            Err(e) => {
                error!("writing to db: {}", e);
                return Ok(Response::builder()
                    .status(StatusCode::INTERNAL_SERVER_ERROR)
                    .body("error saving transfer".to_string())
                    .unwrap());
            }
        };

        Ok(Response::new(serde_json::to_string(&resp).unwrap()))
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
                    .body("id query paramater must be passed".to_owned())
                    .unwrap())
            }
        };

        let dynamodb_request = self
            .dynamodb_client
            .get_item()
            .table_name(self.transfers_table.to_owned())
            .key("id", AttributeValue::S(details_id));

        let details = match dynamodb_request.send().await {
            Ok(resp) => match resp.item() {
                Some(hm) => TransferDetails::from(hm),
                None => {
                    return Ok(Response::builder()
                        .status(404)
                        .body("transfer not found".to_string())
                        .unwrap())
                }
            },
            Err(e) => {
                error!("error getting details from db: {}", e);
                return Ok(Response::builder()
                    .status(404)
                    .body("transfer not found".to_string())
                    .unwrap());
            }
        };

        let resp = serde_json::to_string(&details)?;
        Ok(Response::new(resp))
    }

    fn not_found(&self, _request: Request) -> Result<Response<String>, Error> {
        Ok(Response::builder()
            .status(404)
            .body("route not found".to_string())
            .unwrap())
    }
}
