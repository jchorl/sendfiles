use crate::errors::{BadRequestError, Error};

use serde::Deserialize;
use std::collections::HashMap;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LambdaWebsocketRequest {
    pub request_context: LambdaWebsocketRequestContext,
    pub query_string_parameters: HashMap<String, String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LambdaWebsocketRequestContext {
    pub connection_id: String,
    pub route_key: String,
}

pub enum Role {
    Offerer,
    Sender,
    Receiver,
}

pub struct ConnectRequest {
    transfer_id: String,
    connection_id: Option<String>,
    role: Role,
}

impl ConnectRequest {
    pub fn parse_from(req: &LambdaWebsocketRequest) -> Result<Self, Error> {
        let transfer_id = match req.query_string_parameters.get("transfer_id") {
            Some(s) => s.clone(),
            _ => return Err(Box::new(BadRequestError {})),
        };

        let connection_id = match req.query_string_parameters.get("connection_id") {
            Some(s) => Some(s.clone()),
            None => None,
        };

        let role = match req.query_string_parameters.get("role").unwrap().as_str() {
            "offerer" => Role::Offerer,
            "sender" => Role::Sender,
            "receiver" => Role::Receiver,
            _ => return Err(Box::new(BadRequestError {})),
        };

        let req = ConnectRequest {
            transfer_id: transfer_id,
            connection_id: connection_id,
            role: role,
        };

        Ok(req)
    }

    pub fn get_connection_id(&self) -> String {
        match self.role {
            Role::Offerer => format!("{}-offerer", self.transfer_id),
            Role::Sender => format!(
                "{}-{}-sender",
                self.transfer_id,
                self.connection_id.clone().unwrap()
            ),
            Role::Receiver => format!(
                "{}-{}-receiver",
                self.transfer_id,
                self.connection_id.clone().unwrap()
            ),
        }
    }
}
