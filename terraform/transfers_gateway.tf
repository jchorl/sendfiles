resource "aws_apigatewayv2_api" "transfers" {
  name                         = "transfers-http-api"
  protocol_type                = "HTTP"
  target                       = aws_lambda_function.transfers_api.arn
  disable_execute_api_endpoint = false # TODO change this to true when fronted by domain
}
