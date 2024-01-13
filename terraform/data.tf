data "aws_iam_policy" "AWSLambdaBasicExecutionRole" {
  arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "archive_file" "dummy" {
  type                    = "zip"
  source_content          = "invalid"
  source_content_filename = "bootstrap"
  output_path             = "../build/dummy.zip"
}
