resource "aws_apigatewayv2_api" "coord" {
  name                         = "transfers-http-api"
  protocol_type                = "WEBSOCKET"
  target                       = aws_lambda_function.transfers_api.arn
  disable_execute_api_endpoint = false # TODO change this to true when fronted by domain
}
