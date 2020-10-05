use chrono::{DateTime, Utc};
use lambda_http::{lambda, IntoResponse, Request};
use lambda_runtime::{error::HandlerError, Context};
use serde_derive::Deserialize;

fn main() {
    lambda!(entrypoint)
}

fn entrypoint(request: Request, _ctx: Context) -> Result<impl IntoResponse, HandlerError> {
    println!("in handler");
    post_transfer_handler(request, _ctx)
}

#[derive(Deserialize)]
struct TransferDetails {
    #[serde(rename = "fileName")]
    file_name: String,
    #[serde(rename = "contentLengthBytes")]
    content_length_bytes: u32,
    #[serde(rename = "privateKey")]
    private_key: String,
    #[serde(rename = "validUntil")]
    valid_until: DateTime<Utc>,
}

fn post_transfer_handler(
    request: Request,
    _ctx: Context,
) -> Result<impl IntoResponse, HandlerError> {
    let body = request.into_body();
    let details: TransferDetails = serde_json::from_slice(body.as_ref())?;
    println!(
        "file_name: {}, content_length_bytes: {}, valid_until: {}",
        details.file_name, details.content_length_bytes, details.valid_until
    );
    Ok("hello world")
}
