resource "aws_dynamodb_table" "offers_table" {
  name           = "OffersTest"
  billing_mode   = "PROVISIONED"
  read_capacity  = 2
  write_capacity = 2
  hash_key       = "transfer_id"

  attribute {
    name = "transfer_id"
    type = "S"
  }

  ttl {
    attribute_name = "valid_until"
    enabled        = true
  }
}

data "aws_iam_policy_document" "coord_lambda" {
  statement {
    sid = "1"

    actions = [
      "sts:AssumeRole",
    ]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "coord" {
  name = "coord_lambda_role"

  assume_role_policy = data.aws_iam_policy_document.coord_lambda.json
}

data "aws_iam_policy_document" "coord" {
  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
    ]

    resources = [
      aws_dynamodb_table.offers_table.arn
    ]
  }

  statement {
    actions = [
      "execute-api:ManageConnections",
    ]

    resources = [
      "${aws_apigatewayv2_api.coord.execution_arn}/*/POST/@connections/{connectionId}"
    ]
  }

  statement {
    sid    = "Logging"
    effect = "Allow"

    resources = [
      "arn:aws:logs:*:*:*"
    ]

    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
  }
}

resource "aws_iam_policy" "coord" {
  name   = "coord_lambda_policy"
  policy = data.aws_iam_policy_document.coord.json
}

resource "aws_iam_role_policy_attachment" "coord" {
  role       = aws_iam_role.coord.name
  policy_arn = aws_iam_policy.coord.arn
}

resource "aws_lambda_function" "coord_api" {
  filename      = "build/coord_lambda.zip"
  function_name = "coord_api"
  role          = aws_iam_role.coord.arn
  handler       = "main"

  source_code_hash = filebase64sha256("build/coord_lambda.zip")

  runtime = "provided"
}

resource "aws_lambda_permission" "coord_apigw" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.coord_api.arn
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.coord.execution_arn}/*/*"
}
