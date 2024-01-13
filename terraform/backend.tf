# to bootstrap, comment the terraform {...} block out and run
# terraform apply -target 'aws_s3_bucket.securesend_tf_state'
#
# then uncomment it back in and run
# terraform init -migrate-state

terraform {
  backend "s3" {
    bucket = "securesend-tf-state-0"
    key    = "tfstate"
  }
}
