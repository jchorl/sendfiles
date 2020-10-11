use serde::Serialize;
use std::collections::HashMap;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LambdaWebsocketResponse {
    is_base_64_encoded: bool,
    status_code: u16,
    headers: HashMap<String, String>,
    body: String,
}

impl Default for LambdaWebsocketResponse {
    fn default() -> Self {
        LambdaWebsocketResponse {
            is_base_64_encoded: false,
            status_code: 200,
            headers: Default::default(),
            body: Default::default(),
        }
    }
}
