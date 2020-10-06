use chrono::{DateTime, Utc};
use dynomite::{
    dynamodb::{DynamoDb, DynamoDbClient, GetItemInput, PutItemInput},
    retry::Policy,
    FromAttributes, Item, Retries,
};
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
    match request.uri().path() {
        "/transfers" => post_transfer_handler(request).await,
        "/transfer" => get_transfer_handler(request).await,
        _ => not_found(request),
    }
}

#[derive(Serialize, Deserialize, Item, Clone)]
struct TransferDetails {
    #[serde(rename = "id")]
    #[dynomite(partition_key)]
    id: Option<String>,
    #[serde(rename = "fileName")]
    file_name: String,
    #[serde(rename = "contentLengthBytes")]
    content_length_bytes: u32,
    #[serde(rename = "privateKey")]
    private_key: String,
    #[serde(rename = "validUntil")]
    valid_until: DateTime<Utc>,
}

async fn post_transfer_handler(request: Request) -> Result<Response<String>, Error> {
    let body = request.into_body();
    let mut details: TransferDetails = serde_json::from_slice(body.as_ref())?;
    details.id = Some(Uuid::new_v4().to_hyphenated().to_string());

    let client = DynamoDbClient::new(Region::UsWest2).with_retries(Policy::default());
    let input = PutItemInput {
        table_name: "SecuresendTransfersTest".to_string(),
        item: details.clone().into(),
        ..PutItemInput::default()
    };

    let result = client.put_item(input).await;
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

async fn get_transfer_handler(request: Request) -> Result<Response<String>, Error> {
    let client = DynamoDbClient::new(Region::UsWest2).with_retries(Policy::default());
    let details_id = request
        .query_string_parameters()
        .get("id")
        .unwrap()
        .to_string();

    let details_key = TransferDetailsKey {
        id: Some(details_id),
    };

    let result = client
        .get_item(GetItemInput {
            table_name: "SecuresendTransfersTest".to_string(),
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

    let details = TransferDetails::from_attrs(result.unwrap().item.unwrap()).unwrap();
    let resp = serde_json::to_string(&details)?;
    Ok(Response::new(resp))
}

fn not_found(_request: Request) -> Result<Response<String>, Error> {
    Ok(Response::builder()
        .status(404)
        .body("".to_string())
        .unwrap())
}
