use chrono::{DateTime, Utc};
use dynomite::{
    dynamodb::{DynamoDb, DynamoDbClient, GetItemInput, PutItemInput},
    retry::Policy,
    FromAttributes, Item, Retries,
};
use http::method::Method;
use lambda_http::{
    lambda::{lambda, Context},
    IntoResponse, Request, RequestExt, Response,
};
use rusoto_core::Region;
use serde_derive::{Deserialize, Serialize};
use uuid::Uuid;

type Error = Box<dyn std::error::Error + Send + Sync + 'static>;

#[lambda(http)]
#[tokio::main]
async fn main(request: Request, _: Context) -> Result<impl IntoResponse, Error> {
    let api = Api {
        db_client: Box::new(DynamoDbClient::new(Region::default()).with_retries(Policy::default())),
        transfers_table: "Transfers".to_string(),
    };

    match request.method() {
        &Method::POST => api.post_transfer_handler(request).await,
        &Method::GET => api.get_transfer_handler(request).await,
        _ => api.not_found(request),
    }
}

#[derive(Serialize, Deserialize, Item, Clone)]
#[serde(rename_all = "camelCase")]
struct TransferDetails {
    #[serde(skip_deserializing)]
    #[dynomite(partition_key)]
    id: String,
    file_name: String,
    content_length_bytes: u32,
    private_key: String,
    valid_until: DateTime<Utc>,
}

struct Api {
    db_client: Box<dyn DynamoDb + Send + Sync>,
    transfers_table: String,
}

impl Api {
    async fn post_transfer_handler(&self, request: Request) -> Result<Response<String>, Error> {
        let body = request.into_body();
        let mut details: TransferDetails = serde_json::from_slice(body.as_ref())?;
        details.id = Uuid::new_v4().to_hyphenated().to_string();

        let input = PutItemInput {
            table_name: self.transfers_table.clone(),
            item: details.clone().into(),
            ..PutItemInput::default()
        };

        let result = self.db_client.put_item(input).await;
        if let Err(e) = result {
            println!("error writing details to db: {}", e);
            return Ok(Response::builder()
                .status(500)
                .body("error saving transfer".to_string())
                .unwrap());
        }

        let resp = serde_json::to_string(&details)?;
        Ok(Response::new(resp))
    }

    async fn get_transfer_handler(&self, request: Request) -> Result<Response<String>, Error> {
        let details_id = request
            .query_string_parameters()
            .get("id")
            .unwrap()
            .to_string();

        let details_key = TransferDetailsKey {
            id: details_id.clone(),
        };

        let result = self
            .db_client
            .get_item(GetItemInput {
                table_name: self.transfers_table.clone(),
                key: details_key.into(),
                ..GetItemInput::default()
            })
            .await;
        if let Err(e) = result {
            println!("error getting details from db: {}", e);
            return Ok(Response::builder()
                .status(404)
                .body("transfer not found".to_string())
                .unwrap());
        }

        let item = result.unwrap().item;
        if let None = item {
            println!("item not found: {}", details_id);
            return Ok(Response::builder()
                .status(404)
                .body("transfer not found".to_string())
                .unwrap());
        }

        let details = TransferDetails::from_attrs(item.unwrap()).unwrap();
        let resp = serde_json::to_string(&details)?;
        Ok(Response::new(resp))
    }

    fn not_found(&self, _request: Request) -> Result<Response<String>, Error> {
        Ok(Response::builder()
            .status(404)
            .body("".to_string())
            .unwrap())
    }
}
