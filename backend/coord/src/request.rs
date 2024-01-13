use std::str::FromStr;

use aws_lambda_events::apigw::ApiGatewayWebsocketProxyRequest;

pub enum Role {
    Offerer,
    Sender,
    Receiver,
}

impl FromStr for Role {
    type Err = ();

    fn from_str(input: &str) -> Result<Role, Self::Err> {
        match input.to_lowercase().as_ref() {
            "offerer" => Ok(Role::Offerer),
            "sender" => Ok(Role::Sender),
            "receiver" => Ok(Role::Receiver),
            _ => Err(()),
        }
    }
}

pub struct ConnectRequest {
    pub transfer_id: String,
    pub role: Role,
}

impl TryFrom<&ApiGatewayWebsocketProxyRequest> for ConnectRequest {
    type Error = ();

    fn try_from(request: &ApiGatewayWebsocketProxyRequest) -> Result<Self, Self::Error> {
        Ok(ConnectRequest {
            transfer_id: request
                .query_string_parameters
                .first("transfer_id")
                .ok_or(())?
                .to_owned(),
            role: request
                .query_string_parameters
                .first("role")
                .ok_or(())
                .and_then(Role::from_str)?,
        })
    }
}
