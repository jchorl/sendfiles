use dynomite::{
    dynamodb::{DynamoDb, DynamoDbClient, PutItemInput},
    retry::Policy,
    Item, Retries,
};
use lambda_http::{
    lambda::{lambda, Context},
    IntoResponse, Request, Response,
};
use rusoto_core::Region;
use serde_derive::{Deserialize, Serialize};

type Error = Box<dyn std::error::Error + Send + Sync + 'static>;

#[lambda(http)]
#[tokio::main]
async fn main(request: Request, _: Context) -> Result<impl IntoResponse, Error> {
    let api = Api {
        db_client: Box::new(DynamoDbClient::new(Region::UsWest2).with_retries(Policy::default())),
        connection_table: "ConnectionsTest".to_string(),
    };

    match request.uri().path() {
        "/connect/offer" => api.connect(request, Role::Offerer).await, // sender chills here waiting for receivers
        "/connect/transfer/receiver" => api.connect(request, Role::Receiver).await, // receiver connects with a transfer ID
        "/connect/transfer/sender" => api.connect(request, Role::Sender).await, // sender also connects with a transfer ID
        _ => api.not_found(request),
    }
}

struct Api {
    db_client: Box<dyn DynamoDb + Send + Sync>,
    connection_table: String,
}

enum Role {
    Offerer,
    Sender,
    Receiver,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConnectionRequest {
    transfer_id: String,
    connection_id: Option<String>,
}

#[derive(Item, Clone)]
struct Connection {
    #[dynomite(partition_key)]
    id: String,
    api_gateway_connection_id: String,
}

fn get_connection_id(req: ConnectionRequest, role: Role) -> String {
    match role {
        Role::Offerer => format!("{}-offerer", req.transfer_id),
        Role::Sender => format!("{}-{}-sender", req.transfer_id, req.connection_id.unwrap()),
        Role::Receiver => format!(
            "{}-{}-receiver",
            req.transfer_id,
            req.connection_id.unwrap()
        ),
    }
}

impl Api {
    async fn connect(&self, request: Request, role: Role) -> Result<Response<String>, Error> {
        let body = request.into_body();
        let conn_req: ConnectionRequest = serde_json::from_slice(body.as_ref())?;

        // let req_ctx = request.request_context();

        let conn = Connection {
            id: get_connection_id(conn_req, role),
            api_gateway_connection_id: "someid".to_string(), // TODO fix this shit
        };

        let input = PutItemInput {
            table_name: self.connection_table.clone(),
            item: conn.clone().into(),
            ..PutItemInput::default()
        };

        let result = self.db_client.put_item(input).await;
        if let Err(e) = result {
            println!("error writing connection to db: {}", e);
            return Ok(Response::builder()
                .status(500)
                .body("error saving connection".to_string())
                .unwrap());
        }

        Ok(Response::new(Default::default()))
    }

    fn not_found(&self, _request: Request) -> Result<Response<String>, Error> {
        Ok(Response::builder()
            .status(404)
            .body("".to_string())
            .unwrap())
    }
}
