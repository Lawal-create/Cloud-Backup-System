# Cloud-Backup-System

A cloud-based backup system where users can create accounts, upload, and manage files, with various modes of complexity and additional features.

## Getting started

### Prerequisites

- [Node](https://nodejs.org) >=v8.x and <v14.x : You can make use of [nvm](https://github.com/nvm-sh/nvm) (Node Version Manager) to manage node versions.
- yarn installed >=1.16.x
- Git installed
- Typescript
- [PostgreSQL](https://www.postgresql.org/)

### Pre-test Setup

To set up the project on your local machine, follow the steps below:

1. Clone the repository and checkout into the most updated branch. For more info, refer to this [article](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository)

2. After cloning, navigate into the repo using:

   ```
   cd cloud-backup-system
   ```

3. RUN `yarn` to install all the necessary dependencies

4. Ensure that the PostgreSQL instance on your machine is running.

5. Create a database called virtual_bank_account (or any arbitrary name of your choice)

6. Get a working `.env` file. There is a template to follow which is `.env.example`

### How to test

```
1.  yarn migrate:test
2.  yarn test
```

### How to start the service

```
1.  yarn migrate:test
2.  yarn build
3.  yarn start:dev
```
