resource "aws_dynamodb_table" "connections-table" {
  name           = "connections"
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 20
  hash_key       = "connection_id" # this should include sender/receiver

  attribute {
    name = "connection_id"
    type = "S"
  }

  ttl {
    attribute_name = "valid_until"
    enabled        = true
  }
}
