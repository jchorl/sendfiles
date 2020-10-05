resource "aws_dynamodb_table" "securesend-table" {
  name           = "SecuresendTransfersTest"
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 20
  hash_key       = "Id"

  attribute {
    name = "Id"
    type = "S"
  }

  ttl {
    attribute_name = "ValidUntil"
    enabled        = true
  }
}
