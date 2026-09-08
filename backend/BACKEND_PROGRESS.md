\# Backend Progress \& Setup Documentation



\## Project Management System — Backend



This document records the backend work completed so far, how to run and test the backend locally, how it connects to PostgreSQL, and what remains to be implemented.



\---



\## 1. Backend Technology Stack



Current backend stack:



\* Java 21

\* Spring Boot 4.0.8

\* Spring Web MVC

\* Spring Data JPA

\* Spring Security

\* Spring Validation

\* PostgreSQL 18

\* Maven Wrapper 3.9.16

\* Docker / Docker Compose



The backend is located in:



```text

backend/

```



\---



\## 2. Backend Application



Main application class:



```text

backend/src/main/java/backend/BackendApplication.java

```



Package:



```text

backend

```



The application starts using Spring Boot.



\---



\## 3. Database Setup



The project uses PostgreSQL through Docker Compose.



Docker Compose file:



```text

docker-compose.yml

```



PostgreSQL container:



```text

taskmanager-postgres

```



Default database:



```text

taskmanager

```



Default local connection:



```text

Host: localhost

Port: 5432

Database: taskmanager

Username: postgres

Password: postgres

```



The project Docker PostgreSQL uses port \*\*5432\*\*.



Do not change the backend database configuration to the local PostgreSQL installation on port 5433 unless the project configuration is intentionally changed.



\---



\## 4. Starting PostgreSQL



From the project root:



```cmd

cd D:\\\\proj\\\_management

docker compose up -d

```



Check the container:



```cmd

docker ps

```



The PostgreSQL container should show as healthy.



To stop the database:



```cmd

docker compose down

```



The database data is stored in the Docker volume:



```text

pgdata

```



\---



\## 5. Database Schema



Database initialization script:



```text

database/init/01-init.sql

```



The database currently contains these tables:



```text

milestones

project\\\_members

projects

roles

task\\\_assignees

task\\\_dependencies

tasks

users

```



Hibernate is configured to validate the existing database schema rather than create or modify it.



Current configuration:



```properties

spring.jpa.hibernate.ddl-auto=validate

```



This means the database schema is owned by:



```text

database/init/01-init.sql

```



and Hibernate checks that the Java entities match the database structure.



\---



\## 6. Backend Database Configuration



File:



```text

backend/src/main/resources/application.properties

```



Current configuration:



```properties

spring.application.name=backend



spring.datasource.url=${SPRING\\\_DATASOURCE\\\_URL:jdbc:postgresql://localhost:5432/taskmanager}

spring.datasource.username=${SPRING\\\_DATASOURCE\\\_USERNAME:postgres}

spring.datasource.password=${SPRING\\\_DATASOURCE\\\_PASSWORD:postgres}

spring.datasource.driver-class-name=org.postgresql.Driver



spring.jpa.hibernate.ddl-auto=validate

spring.jpa.open-in-view=false

spring.jpa.show-sql=true

spring.jpa.properties.hibernate.format\\\_sql=true

```



Environment variables can override the default database connection:



```text

SPRING\\\_DATASOURCE\\\_URL

SPRING\\\_DATASOURCE\\\_USERNAME

SPRING\\\_DATASOURCE\\\_PASSWORD

```



Do not commit real database passwords or other secrets.



\---



\## 7. Entity Layer



Entities were created to match the database schema.



Location:



```text

backend/src/main/java/backend/entity/

```



Current entities:



```text

Role.java

User.java

Project.java

ProjectMember.java

Milestone.java

Task.java

TaskAssignee.java

TaskDependency.java

```



\### Relationships



Main relationships include:



```text

Role

\&#x20;└── Users



User

\&#x20;├── Projects managed

\&#x20;├── Project memberships

\&#x20;├── Tasks created

\&#x20;└── Task assignments



Project

\&#x20;├── Manager

\&#x20;├── Members

\&#x20;├── Milestones

\&#x20;└── Tasks



Milestone

\&#x20;└── Tasks



Task

\&#x20;├── Project

\&#x20;├── Milestone

\&#x20;├── Assignees

\&#x20;└── Dependencies

```



The entities intentionally do not use bidirectional relationships everywhere. This helps avoid recursive JSON serialization problems.



\---



\## 8. Repository Layer



Location:



```text

backend/src/main/java/backend/repository/

```



Repositories:



```text

RoleRepository.java

UserRepository.java

ProjectRepository.java

ProjectMemberRepository.java

MilestoneRepository.java

TaskRepository.java

TaskAssigneeRepository.java

TaskDependencyRepository.java

```



All repositories use Spring Data JPA.



Examples of supported queries include:



```text

User by username

User by email



Milestones by project



Tasks by project

Tasks by milestone

Tasks by status



Project members by project

Project members by user



Task assignees by task

Task assignees by user



Task dependencies by task

Dependent tasks by dependency

```



\---



\## 9. Service Layer



Location:



```text

backend/src/main/java/backend/service/

```



Services:



```text

ProjectService.java

UserService.java

MilestoneService.java

TaskService.java

ProjectMemberService.java

TaskAssigneeService.java

TaskDependencyService.java

```



The service layer currently provides basic CRUD operations and common lookup operations.



Examples:



```text

getAll

getById

create

update

delete

```



Additional lookups are available for projects, milestones, tasks, members, assignees, and dependencies.



\---



\## 10. Controller / REST API Layer



Location:



```text

backend/src/main/java/backend/controller/

```



Controllers:



```text

HealthController.java

UserController.java

ProjectController.java

MilestoneController.java

TaskController.java

ProjectMemberController.java

TaskAssigneeController.java

TaskDependencyController.java

```



\### Health Endpoint



```http

GET /api/health

```



This endpoint does not require authentication.



Expected response:



```text

Backend API is running

```



\### Users



```http

GET    /api/users

GET    /api/users/{id}

GET    /api/users/username/{username}

POST   /api/users

PUT    /api/users/{id}

DELETE /api/users/{id}

```



\### Projects



```http

GET    /api/projects

GET    /api/projects/{id}

POST   /api/projects

PUT    /api/projects/{id}

DELETE /api/projects/{id}

```



\### Milestones



```http

GET    /api/milestones

GET    /api/milestones/{id}

GET    /api/milestones/project/{projectId}

POST   /api/milestones

PUT    /api/milestones/{id}

DELETE /api/milestones/{id}

```



\### Tasks



```http

GET    /api/tasks

GET    /api/tasks/{id}

GET    /api/tasks/project/{projectId}

GET    /api/tasks/milestone/{milestoneId}

GET    /api/tasks/status/{status}

POST   /api/tasks

PUT    /api/tasks/{id}

DELETE /api/tasks/{id}

```



\### Project Members



```http

GET    /api/project-members

GET    /api/project-members/{id}

GET    /api/project-members/project/{projectId}

GET    /api/project-members/user/{userId}

POST   /api/project-members

PUT    /api/project-members/{id}

DELETE /api/project-members/{id}

```



\### Task Assignees



```http

GET    /api/task-assignees

GET    /api/task-assignees/{id}

GET    /api/task-assignees/task/{taskId}

GET    /api/task-assignees/user/{userId}

POST   /api/task-assignees

DELETE /api/task-assignees/{id}

```



\### Task Dependencies



```http

GET    /api/task-dependencies

GET    /api/task-dependencies/task/{taskId}

GET    /api/task-dependencies/depends-on/{taskId}

POST   /api/task-dependencies

DELETE /api/task-dependencies?taskId={taskId}\\\&dependsOnTaskId={dependsOnTaskId}

```



\---



\## 11. Security



Security configuration:



```text

backend/src/main/java/backend/config/SecurityConfig.java

```



Current configuration allows:



```text

/api/health

```



without authentication.



All other endpoints currently require authentication:



```java

.requestMatchers("/api/health").permitAll()

.anyRequest().authenticated()

```



\### Important



Authentication has \*\*not yet been fully implemented\*\*.



Therefore, requests such as:



```cmd

curl -i http://localhost:8090/api/projects

```



currently return:



```text

HTTP/1.1 403

```



This is expected with the current security configuration.



The next security task is to implement the project's actual authentication system.



\---



\## 12. Starting the Backend



First make sure PostgreSQL is running:



```cmd

docker compose up -d

```



Then open a CMD terminal:



```cmd

cd D:\\\\proj\\\_management\\\\backend

```



Start Spring Boot:



```cmd

mvnw.cmd spring-boot:run

```



The default Spring Boot port is normally:



```text

8080

```



However, ports 8080 and 8081 were occupied during development.



For local testing, the backend was successfully started on:



```text

8090

```



using:



```cmd

mvnw.cmd spring-boot:run -Dspring-boot.run.arguments="--server.port=8090"

```



This command only overrides the port for that particular run. It does not modify `application.properties`.



Successful startup contains:



```text

Tomcat started on port 8090 (http)

```



and:



```text

Started BackendApplication

```



Keep this terminal running while testing the API.



\---



\## 13. Testing the Backend



Open a second CMD window.



\### Health check



Run:



```cmd

curl -i http://localhost:8090/api/health

```



Expected:



```text

HTTP/1.1 200

```



and:



```text

Backend API is running

```



This test was successfully completed.



\### Protected endpoint



Run:



```cmd

curl -i http://localhost:8090/api/projects

```



Currently this returns:



```text

HTTP/1.1 403

```



because authentication has not yet been implemented.



This confirms that Spring Security is protecting the endpoint.



\---



\## 14. Maven Tests



Run from:



```text

D:\\\\proj\\\_management\\\\backend

```



Command:



```cmd

mvnw.cmd test

```



The backend test suite successfully completed with:



```text

Tests run: 1

Failures: 0

Errors: 0

Skipped: 0

BUILD SUCCESS

```



The test successfully connected to:



```text

jdbc:postgresql://localhost:5432/taskmanager

```



Hibernate also successfully validated the database schema.



Some development warnings were displayed by Spring Security and Mockito. They did not cause test failures.



\---



\## 15. Backend Project Structure



Current structure:



```text

backend/

├── src/

│   ├── main/

│   │   ├── java/

│   │   │   └── backend/

│   │   │       ├── BackendApplication.java

│   │   │       │

│   │   │       ├── config/

│   │   │       │   └── SecurityConfig.java

│   │   │       │

│   │   │       ├── controller/

│   │   │       │   ├── HealthController.java

│   │   │       │   ├── UserController.java

│   │   │       │   ├── ProjectController.java

│   │   │       │   ├── MilestoneController.java

│   │   │       │   ├── TaskController.java

│   │   │       │   ├── ProjectMemberController.java

│   │   │       │   ├── TaskAssigneeController.java

│   │   │       │   └── TaskDependencyController.java

│   │   │       │

│   │   │       ├── entity/

│   │   │       │   ├── Role.java

│   │   │       │   ├── User.java

│   │   │       │   ├── Project.java

│   │   │       │   ├── ProjectMember.java

│   │   │       │   ├── Milestone.java

│   │   │       │   ├── Task.java

│   │   │       │   ├── TaskAssignee.java

│   │   │       │   └── TaskDependency.java

│   │   │       │

│   │   │       ├── repository/

│   │   │       │   ├── RoleRepository.java

│   │   │       │   ├── UserRepository.java

│   │   │       │   ├── ProjectRepository.java

│   │   │       │   ├── ProjectMemberRepository.java

│   │   │       │   ├── MilestoneRepository.java

│   │   │       │   ├── TaskRepository.java

│   │   │       │   ├── TaskAssigneeRepository.java

│   │   │       │   └── TaskDependencyRepository.java

│   │   │       │

│   │   │       └── service/

│   │   │           ├── UserService.java

│   │   │           ├── ProjectService.java

│   │   │           ├── MilestoneService.java

│   │   │           ├── TaskService.java

│   │   │           ├── ProjectMemberService.java

│   │   │           ├── TaskAssigneeService.java

│   │   │           └── TaskDependencyService.java

│   │   │

│   │   └── resources/

│   │       └── application.properties

│   │

│   └── test/

│

├── pom.xml

├── mvnw

├── mvnw.cmd

└── BACKEND\\\_PROGRESS.md

```



\---



\## 16. Current Git State



Backend implementation was committed on the feature branch:



```text

backend/api-core

```



Current commit:



```text

4a631da feat: add backend entities repositories services and controllers

```



The working tree was clean after the commit.



The branch has not yet been pushed at the time this document was created.



\---



\## 17. Work Completed



Completed:



\* Spring Boot backend initialization

\* Health API

\* Spring Security base configuration

\* PostgreSQL Docker connection

\* Hibernate database schema validation

\* JPA entities for all current database tables

\* Spring Data repositories

\* Service layer

\* REST controllers

\* CRUD API scaffolding

\* Project/task/milestone/member/assignee/dependency lookup APIs

\* Backend compilation

\* Maven test execution

\* PostgreSQL integration test

\* Local backend startup

\* Health endpoint testing

\* Protected endpoint security testing



\---



\## 18. Known Limitations



The current backend is a foundation/API scaffold and is not yet production-ready.



Remaining important work includes:



1\. Implement real authentication.

2\. Implement password hashing with `PasswordEncoder`.

3\. Define login/authentication API.

4\. Implement authorization based on application roles.

5\. Add request/response DTOs.

6\. Prevent password hashes from being returned by API responses.

7\. Add Bean Validation to request DTOs.

8\. Add proper exception handling and HTTP 404/400/409 responses.

9\. Add business-rule validation.

10\. Implement task dependency business rules.

11\. Add comprehensive controller/service tests.

12\. Integrate the frontend with the REST API.

13\. Update backend README to reflect the current database configuration.

14\. Add production-appropriate security configuration.



\---



\## 19. Important Security Note



Do not expose or commit:



\* passwords

\* API keys

\* JWT secrets

\* database production credentials

\* generated Spring Security development passwords



Local development defaults are currently provided through configuration defaults and Docker Compose.



Production credentials should be supplied through environment variables or an appropriate secret-management system.



\---



\## 20. Recommended Next Backend Work



The recommended order is:



```text

1\\. Authentication

\&#x20;       ↓

2\\. DTOs + Validation

\&#x20;       ↓

3\\. Global Exception Handling

\&#x20;       ↓

4\\. Authorization / Roles

\&#x20;       ↓

5\\. Business Rules

\&#x20;       ↓

6\\. API Integration Tests

\&#x20;       ↓

7\\. Frontend API Integration

```



Authentication should be implemented before exposing protected project/task APIs to the frontend.



\---



\## 21. Local Development Quick Start



\### Terminal 1 — Database



```cmd

cd D:\\\\proj\\\_management

docker compose up -d

```



\### Terminal 2 — Backend



```cmd

cd D:\\\\proj\\\_management\\\\backend

mvnw.cmd spring-boot:run -Dspring-boot.run.arguments="--server.port=8090"

```



\### Terminal 3 — Test API



```cmd

curl -i http://localhost:8090/api/health

```



Expected:



```text

HTTP/1.1 200

Backend API is running

```



Test a protected endpoint:



```cmd

curl -i http://localhost:8090/api/projects

```



Expected currently:



```text

HTTP/1.1 403

```



until authentication is implemented.



\---



\## 22. Development Principle



The backend should continue to follow this structure:



```text

Controller

\&#x20;   ↓

Service

\&#x20;   ↓

Repository

\&#x20;   ↓

PostgreSQL

```



Controllers handle HTTP/API concerns.



Services handle business logic.



Repositories handle database access.



Entities represent database data.



DTOs should eventually be used at the API boundary instead of exposing JPA entities directly.



\---



\## Last Updated



September 4, 2026



Backend feature branch:



```text

backend/api-core

```



Latest backend commit:



```text

4a631da

```

