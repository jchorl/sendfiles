use chrono::{DateTime, Utc};
use lambda_http::{lambda, IntoResponse, Request, Response};
use lambda_runtime::{error::HandlerError, Context};
use serde_derive::{Deserialize, Serialize};
use uuid::Uuid;

fn main() {
    lambda!(entrypoint)
}

fn entrypoint(request: Request, _ctx: Context) -> Result<impl IntoResponse, HandlerError> {
    match request.uri().path() {
        "/transfers" => post_transfer_handler(request),
        "/transfer" => get_transfer_handler(request),
        _ => not_found(request),
    }
}

#[derive(Serialize, Deserialize)]
struct TransferDetails {
    #[serde(rename = "id")]
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

fn post_transfer_handler(request: Request) -> Result<Response<String>, HandlerError> {
    let body = request.into_body();
    let mut details: TransferDetails = serde_json::from_slice(body.as_ref())?;
    details.id = Some(Uuid::new_v4().to_hyphenated().to_string());
    let resp = serde_json::to_string(&details)?;
    Ok(Response::new(resp))
}

fn get_transfer_handler(_request: Request) -> Result<Response<String>, HandlerError> {
    // TODO pull this from a db
    let details = TransferDetails {
        id: Some(Uuid::new_v4().to_hyphenated().to_string()),
        file_name: "my_file.txt".to_string(),
        content_length_bytes: 300,
        private_key: "privkey".to_string(),
        valid_until: Utc::now(),
    };
    let resp = serde_json::to_string(&details)?;
    Ok(Response::new(resp))
}

fn not_found(_request: Request) -> Result<Response<String>, HandlerError> {
    let response = Response::builder()
        .status(404)
        .body("".to_string())
        .unwrap();
    Ok(response)
}
