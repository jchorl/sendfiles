mod errors;
mod request;
mod response;

use dynomite::{
    dynamodb::{DynamoDb, DynamoDbClient, PutItemInput},
    retry::Policy,
    Item, Retries,
};
use lambda::{lambda, Context};
use rusoto_core::Region;

#[lambda]
#[tokio::main]
async fn main(
    request: request::LambdaWebsocketRequest,
    _: Context,
) -> Result<response::LambdaWebsocketResponse, errors::Error> {
    let api = Api {
        db_client: Box::new(DynamoDbClient::new(Region::UsWest2).with_retries(Policy::default())),
        connection_table: "ConnectionsTest".to_string(),
    };

    // TODO match on route_key in context
    api.connect(request).await
}

#[derive(Item, Clone)]
struct Connection {
    #[dynomite(partition_key)]
    id: String,
    api_gateway_connection_id: String,
}

struct Api {
    db_client: Box<dyn DynamoDb + Send + Sync>,
    connection_table: String,
}

impl Api {
    async fn connect(
        &self,
        request: request::LambdaWebsocketRequest,
    ) -> Result<response::LambdaWebsocketResponse, errors::Error> {
        let connect_req = request::ConnectRequest::parse_from(&request)?;
        let connection = Connection {
            id: connect_req.get_connection_id(),
            api_gateway_connection_id: request.request_context.connection_id,
        };

        let input = PutItemInput {
            table_name: self.connection_table.clone(),
            item: connection.clone().into(),
            ..PutItemInput::default()
        };

        self.db_client.put_item(input).await?;
        Ok(Default::default())
    }
}
