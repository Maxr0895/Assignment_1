Assignment 2 - Cloud Services Exercises - Response to Criteria
================================================

Instructions
------------------------------------------------
- Keep this file named A2_response_to_criteria.md, do not change the name
- Upload this file along with your code in the root directory of your project
- Upload this file in the current Markdown format (.md extension)
- Do not delete or rearrange sections.  If you did not attempt a criterion, leave it blank
- Text inside [ ] like [eg. S3 ] are examples and should be removed


Overview
------------------------------------------------

- **Name:** Max Reinhardt
- **Student number:** n8501645
- **Partner name (if applicable):** N/A
- **Application name:** WBR Actionizer
- **Two line description:** A web application for uploading meeting recordings, storing them in the cloud, and tracking metadata for further processing. Core AWS services S3 and DynamoDB are integrated, with authentication and additional AWS features for security and scalability.
- **EC2 instance name or ID:** i-09fafd6e06a392be51

------------------------------------------------

### Core - First data persistence service

- **AWS service name:** Amazon S3
- **What data is being stored?:** Meeting video files (e.g. .webm, .mp4).
- **Why is this service suited to this data?:** S3 is ideal for storing large, unstructured binary objects like video files due to its scalability, durability, and simple object storage model.
- **Why is are the other services used not suitable for this data?:** DynamoDB is designed for structured key–value/NoSQL data, not large binary files. Secrets Manager and Parameter Store are for sensitive strings/configuration, not file storage.
- **Bucket/instance/table name:** a2-n8501645
- **Video timestamp:** [clip showing S3 upload]
- **Relevant files:**
    - routes/meetings.js
    - services/s3Service.js

### Core - Second data persistence service

- **AWS service name:** DynamoDB
- **What data is being stored?:** Metadata for meetings (IDs, filenames, timestamps, statuses).
- **Why is this service suited to this data?:** DynamoDB provides fast lookups, flexible schema for metadata, and automatic scaling. Perfect for key–value structured metadata tied to video files.
- **Why is are the other services used not suitable for this data?:** S3 does not support querying structured attributes, and relational services (e.g. RDS) are more complex than required for simple metadata lookups.
- **Bucket/instance/table name:** a2-n8501645
- **Video timestamp:** [clip showing DynamoDB record creation]
- **Relevant files:**
    - models/meetingModel.js
    - services/dynamoService.js

### Third data service

- **AWS service name:** AWS Systems Manager Parameter Store
- **What data is being stored?:** Application configuration values (e.g., API base URL).
- **Why is this service suited to this data?:** Parameter Store provides centralized configuration management, separating secrets and environment variables from code.
- **Why is are the other services used not suitable for this data?:** S3 and DynamoDB are not intended for secure parameter storage; Secrets Manager is more suited to sensitive API keys rather than general config.
- **Bucket/instance/table name:** Parameter: /wbr/api_base_url
- **Video timestamp:** [clip showing Parameter Store in console]
- **Relevant files:**
    - config/index.js

### S3 Pre-signed URLs

- **S3 Bucket names:** a2-n8501645
- **Video timestamp:** [clip showing upload/download request with pre-signed URL in devtools]
- **Relevant files:**
    - services/s3Service.js

### In-memory cache

- **ElastiCache instance name:** N/A (not implemented)
- **What data is being cached?:** 
- **Why is this data likely to be accessed frequently?:** 
- **Video timestamp:** 
- **Relevant files:**
    - 

### Core - Statelessness

- **What data is stored within your application that is not stored in cloud data services?:** Temporary in-memory processing state during uploads.
- **Why is this data not considered persistent state?:** It can be recreated from persisted S3/DynamoDB data if lost.
- **How does your application ensure data consistency if the app suddenly stops?:** Uploads and metadata writes are persisted immediately to S3/DynamoDB, ensuring no loss of persistent data.
- **Relevant files:**
    - routes/meetings.js

### Graceful handling of persistent connections

- **Type of persistent connection and use:** N/A — application uses stateless REST polling for updates.
- **Method for handling lost connections:** Implemented retry logic and user feedback when network/API errors occur.
- **Relevant files:**
    - frontend/app.js


### Core - Authentication with Cognito

- **User pool name:** a2-n8501645-users
- **How are authentication tokens handled by the client?:** JWT tokens returned from Cognito are stored client-side and sent as Authorization: Bearer headers with API requests.
- **Video timestamp:** [clip showing Cognito pool + signup/login flow]
- **Relevant files:**
    - services/authService.js

### Cognito multi-factor authentication

- **What factors are used for authentication:** Password + authenticator app TOTP code.
- **Video timestamp:** [clip showing MFA login]
- **Relevant files:**
    - cognito-config.json

### Cognito federated identities

- **Identity providers used:** N/A (not implemented).
- **Video timestamp:** 
- **Relevant files:**
    - 

### Cognito groups

- **How are groups used to set permissions?:** Two groups: Admin (can upload + view meetings) and User (view only). App checks user’s group membership to enforce role-based access.
- **Video timestamp:** [clip showing change of group membership affecting permissions]
- **Relevant files:**
    - middleware/authMiddleware.js

### Core - DNS with Route53

- **Subdomain**: a2-n8501645.cab432.com
- **Video timestamp:** [clip showing Route53 record + browser access]

### Parameter store

- **Parameter names:** /wbr/api_base_url
- **Video timestamp:** [clip showing Parameter Store console + usage in code]
- **Relevant files:**
    - config/index.js

### Secrets manager

- **Secrets names:** a2-n8501645-openai-api
- **Video timestamp:** [clip showing Secrets Manager console + usage in code]
- **Relevant files:**
    - services/secretService.js

### Infrastructure as code

- **Technology used:** N/A (handled manually via AWS console for this assessment).
- **Services deployed:** 
- **Video timestamp:** 
- **Relevant files:**
    - 

### Other (with prior approval only)

- **Description:** 
- **Video timestamp:** 
- **Relevant files:**
    - 

### Other (with prior permission only)

- **Description:** 
- **Video timestamp:** 
- **Relevant files:**
    - 
Assignment 2 - Cloud Services Exercises - Response to Criteria
================================================

Instructions
------------------------------------------------
- Keep this file named A2_response_to_criteria.md, do not change the name
- Upload this file along with your code in the root directory of your project
- Upload this file in the current Markdown format (.md extension)
- Do not delete or rearrange sections.  If you did not attempt a criterion, leave it blank
- Text inside [ ] like [eg. S3 ] are examples and should be removed

Overview
------------------------------------------------

Name: Max Reinhardt

Student number: n8501645

Partner name (if applicable): N/A

Application name: WBR Actionizer

Two line description: A web application for uploading meeting recordings, storing them in the cloud, and tracking metadata for further processing. Core AWS services S3 and DynamoDB are integrated, with authentication and additional AWS features for security and scalability.

EC2 instance name or ID: i-09fafd6e06a392be51

Core - First data persistence service

AWS service name: Amazon S3

What data is being stored?: Meeting video files (e.g. .webm, .mp4).

Why is this service suited to this data?: S3 is ideal for storing large, unstructured binary objects like video files due to its scalability, durability, and simple object storage model.

Why are the other services used not suitable for this data?: DynamoDB is designed for structured key–value/NoSQL data, not large binary files. Secrets Manager and Parameter Store are for sensitive strings/configuration, not file storage.

Bucket/instance/table name: a2-n8501645

Video timestamp: [clip showing S3 upload]

Relevant files:

routes/meetings.js

services/s3Service.js

Core - Second data persistence service

AWS service name: DynamoDB

What data is being stored?: Metadata for meetings (IDs, filenames, timestamps, statuses).

Why is this service suited to this data?: DynamoDB provides fast lookups, flexible schema for metadata, and automatic scaling. Perfect for key–value structured metadata tied to video files.

Why are the other services used not suitable for this data?: S3 does not support querying structured attributes, and relational services (e.g. RDS) are more complex than required for simple metadata lookups.

Bucket/instance/table name: a2-n8501645

Video timestamp: [clip showing DynamoDB record creation]

Relevant files:

models/meetingModel.js

services/dynamoService.js

Third data service

AWS service name: AWS Systems Manager Parameter Store

What data is being stored?: Application configuration values (e.g., API base URL).

Why is this service suited to this data?: Parameter Store provides centralized configuration management, separating secrets and environment variables from code.

Why are the other services used not suitable for this data?: S3 and DynamoDB are not intended for secure parameter storage; Secrets Manager is more suited to sensitive API keys rather than general config.

Bucket/instance/table name: Parameter: /wbr/api_base_url

Video timestamp: [clip showing Parameter Store in console]

Relevant files:

config/index.js

S3 Pre-signed URLs

S3 Bucket names: a2-n8501645

Video timestamp: [clip showing upload/download request with pre-signed URL in devtools]

Relevant files:

services/s3Service.js

In-memory cache

ElastiCache instance name: N/A (not implemented)

Core - Statelessness

What data is stored within your application that is not stored in cloud data services?: Temporary in-memory processing state during uploads.

Why is this data not considered persistent state?: It can be recreated from persisted S3/DynamoDB data if lost.

How does your application ensure data consistency if the app suddenly stops?: Uploads and metadata writes are persisted immediately to S3/DynamoDB, ensuring no loss of persistent data.

Relevant files:

routes/meetings.js

Graceful handling of persistent connections

Type of persistent connection and use: N/A — application uses stateless REST polling for updates.

Method for handling lost connections: Implemented retry logic and user feedback when network/API errors occur.

Relevant files:

frontend/app.js

Core - Authentication with Cognito

User pool name: a2-n8501645-users

How are authentication tokens handled by the client?: JWT tokens returned from Cognito are stored client-side and sent as Authorization: Bearer headers with API requests.

Video timestamp: [clip showing Cognito pool + signup/login flow]

Relevant files:

services/authService.js

Cognito multi-factor authentication

What factors are used for authentication: Password + authenticator app TOTP code.

Video timestamp: [clip showing MFA login]

Relevant files:

cognito-config.json

Cognito federated identities

Identity providers used: N/A (not implemented).

Cognito groups

How are groups used to set permissions?: Two groups: Admin (can upload + view meetings) and User (view only). App checks user’s group membership to enforce role-based access.

Video timestamp: [clip showing change of group membership affecting permissions]

Relevant files:

middleware/authMiddleware.js

Core - DNS with Route53

Subdomain: a2-n8501645.cab432.com

Video timestamp: [clip showing Route53 record + browser access]

Parameter store

Parameter names: /wbr/api_base_url

Video timestamp: [clip showing Parameter Store console + usage in code]

Relevant files:

config/index.js

Secrets manager

Secrets names: a2-n8501645-openai-api

Video timestamp: [clip showing Secrets Manager console + usage in code]

Relevant files:

services/secretService.js

Infrastructure as code

Technology used: N/A (handled manually via AWS console for this assessment).