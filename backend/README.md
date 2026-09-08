# Backend

Spring Boot REST API for the Task & Project Management System.

## Stack

* Java 21
* Spring Boot 4.0.8 (Web MVC, Data JPA, Security, Validation)
* PostgreSQL (driver included; connection not yet configured)
* Maven 3.9.16

## Getting Started

```bash
./mvnw spring-boot:run
```

During development, the backend can be run on port `8081` when PostgreSQL is not yet configured:

```bash
./mvnw spring-boot:run -Dspring-boot.run.arguments="--server.port=8081 --spring.autoconfigure.exclude=org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration"
```

Backend API:

```text
http://localhost:8081
```

Run tests:

```bash
./mvnw test
```

Tests currently require the database configuration because the application context includes JPA/DataSource configuration.

## Project Structure

```text
src/main/java/backend/
├── BackendApplication.java    # Application entry point
├── controller/                # REST controllers
└── config/                    # Application and security configuration

src/main/resources/
└── application.properties     # Application configuration

src/test/java/backend/         # Tests
```

## API Endpoints

| Method | Path          | Description  | Status      |
| ------ | ------------- | ------------ | ----------- |
| GET    | `/api/health` | Health check | Implemented |

### Health Check

The health endpoint is publicly accessible and does not require authentication.

```text
GET /api/health
```

Expected response:

```text
Backend API is running
```

The endpoint has been tested successfully with HTTP `200 OK` while the backend is running on port `8081`.

## Security

Spring Security is configured using `SecurityConfig.java`.

Current security behavior:

* `/api/health` is publicly accessible.
* Other endpoints require authentication.
* Full application authentication/authorization will be implemented as part of the backend authentication work.

## Database

PostgreSQL is the planned database for the system.

Current status:

```text
PostgreSQL installation       done
PostgreSQL driver             done
Database connection           pending
Database schema               pending
Backend JPA entities          pending
Repositories                  pending
```

The backend database integration is waiting for the Database team to complete and provide the project schema.

Business entities and repositories should not be implemented until the database schema is finalized.

See:

```text
database/README.md
```

once the database schema is available.

## Frontend Integration

The frontend team is currently developing and updating the frontend application.

Backend/frontend integration will begin once the frontend API requirements and database schema are available.

The integration will connect the React frontend to the Spring Boot REST API through HTTP requests.

The API contract will define:

* Endpoint URLs
* HTTP methods
* Request data
* Response data
* Authentication requirements
* Validation rules
* Error responses

Planned integration flow:

```text
React Frontend
      |
      | HTTP / REST API
      v
Spring Boot Backend
      |
      v
Service Layer
      |
      v
Repository Layer
      |
      v
PostgreSQL
```

The backend team will coordinate with the frontend team to ensure that frontend API requests match the implemented backend endpoints.

## Current Status

```text
Backend project setup       done
Spring Boot                 done
Java 21                     done
REST controller             done
Health endpoint             done
Security configuration      done
PostgreSQL driver           done
Database connection         pending — waiting for database team
Database schema             pending — waiting for database team
Business entities           pending — depends on database schema
Repositories                pending — depends on database schema
Business REST APIs          pending
Frontend/backend integration pending — depends on API requirements
Authentication              pending
```

## Next Steps

1. Wait for the Database team to finalize the database schema.
2. Review the frontend team's API requirements.
3. Define the backend API contract.
4. Create the required JPA entities based on the finalized database schema.
5. Implement repositories and service-layer business logic.
6. Implement the required REST API endpoints.
7. Complete authentication and authorization.
8. Integrate the React frontend with the backend API.
9. Test the complete frontend → backend → database workflow.

## Contributing

See the root `README.md` and `Contributing.md` for branch naming (`backend/<task>`) and the project PR workflow.
