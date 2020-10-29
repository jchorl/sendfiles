locals {
  coord_routes = {
    connect = {
      route_key      = "$connect"
      operation_name = "ConnectRoute"
    }
    disconnect = {
      route_key      = "$disconnect"
      operation_name = "DisconnectRoute"
    }
    sendmessage = {
      route_key      = "SEND_MESSAGE"
      operation_name = "SendRoute"
    }
  }
}

resource "aws_apigatewayv2_api" "coord" {
  name                         = "coord-ws-api"
  protocol_type                = "WEBSOCKET"
  route_selection_expression   = "$request.body.action"
  disable_execute_api_endpoint = true
}

resource "aws_apigatewayv2_deployment" "coord_deployment" {
  api_id = aws_apigatewayv2_api.coord.id

  depends_on = [aws_apigatewayv2_route.coord_route]

  triggers = {
    redeployment = sha1(join(",", list(
      jsonencode(aws_apigatewayv2_integration.coord_integration),
      jsonencode(aws_apigatewayv2_route.coord_route),
    )))
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_apigatewayv2_stage" "coord_stage" {
  api_id        = aws_apigatewayv2_api.coord.id
  name          = "prod"
  description   = "Prod Stage"
  deployment_id = aws_apigatewayv2_deployment.coord_deployment.id
}

resource "aws_apigatewayv2_integration" "coord_integration" {
  api_id             = aws_apigatewayv2_api.coord.id
  integration_type   = "AWS_PROXY"
  description        = "integration"
  integration_uri    = aws_lambda_function.coord_api.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "coord_route" {
  for_each       = local.coord_routes
  api_id         = aws_apigatewayv2_api.coord.id
  route_key      = each.value.route_key
  operation_name = each.value.operation_name
  target         = "integrations/${aws_apigatewayv2_integration.coord_integration.id}"
}

resource "aws_apigatewayv2_domain_name" "coord" {
  domain_name = "coord.sendfiles.dev"

  domain_name_configuration {
    certificate_arn = aws_acm_certificate.coord.arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_apigatewayv2_api_mapping" "coord" {
  api_id      = aws_apigatewayv2_api.coord.id
  domain_name = aws_apigatewayv2_domain_name.coord.id
  stage       = aws_apigatewayv2_stage.coord_stage.id
}
