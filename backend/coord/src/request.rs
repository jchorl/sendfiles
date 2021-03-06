use crate::errors::{BadRequestError, Error};

use serde::Deserialize;
use std::collections::HashMap;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LambdaWebsocketRequest {
    pub request_context: LambdaWebsocketRequestContext,
    #[serde(default)]
    pub query_string_parameters: HashMap<String, String>,
    #[serde(default)]
    body: String,
    #[serde(default)]
    is_base_64_encoded: bool,
}

impl LambdaWebsocketRequest {
    pub fn get_body(&self) -> String {
        if !self.is_base_64_encoded {
            return self.body.clone();
        }

        String::from_utf8(base64::decode(self.body.clone()).unwrap()).unwrap()
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LambdaWebsocketRequestContext {
    pub connection_id: String,
    pub domain_name: String,
    pub route_key: String,
    pub stage: String,
}

pub enum Role {
    Offerer,
    Sender,
    Receiver,
}

pub struct ConnectRequest {
    pub transfer_id: String,
    pub role: Role,
}

impl ConnectRequest {
    pub fn parse_from(req: &LambdaWebsocketRequest) -> Result<Self, Error> {
        let transfer_id = match req.query_string_parameters.get("transfer_id") {
            Some(s) => s.clone(),
            _ => return Err(Box::new(BadRequestError {})),
        };

        let role = match req.query_string_parameters.get("role").unwrap().as_str() {
            "offerer" => Role::Offerer,
            "sender" => Role::Sender,
            "receiver" => Role::Receiver,
            _ => return Err(Box::new(BadRequestError {})),
        };

        let req = ConnectRequest {
            transfer_id: transfer_id,
            role: role,
        };

        Ok(req)
    }
}
