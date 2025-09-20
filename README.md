# Task Master

Task Master is a command-line tool designed to streamline the process of creating tasks, managing branches, and submitting pull requests for software development projects. It consists of two main components: the Task Builder and the PR Builder.

## Features

- Task Builder: Helps create and manage development tasks
- PR Builder: Automates the process of creating pull requests
- Integration with Bitbucket
- Local task database management
- Interactive command-line interface

## Prerequisites

Before you begin, ensure you have met the following requirements:

- Node.js (v12 or higher) installed on your system
- npm (usually comes with Node.js)
- Git installed and configured
- A Bitbucket account with appropriate permissions

## Installation

1. Clone the repository:
    ```
    git clone https://github.com/Syras206/task-master.git
    cd task-master
    ```
   
2. Install the dependencies:
    ```
    npm install
    ```

3. Run the install script, which will guide you through the installation in order to add the necessary files.
    ```
    npm run install
    ```

## Usage

### Task Builder

To create a new task:

```
npm run tasks
```

This will guide you through the process of creating a new task, including:
- Selecting the system (repository)
- Creating a new branch
- Defining task details
- Creating a step-by-step plan

### PR Builder

To create a pull request for an existing branch:

```
npm run pr <system> <branch-name>
```

For example:
```
npm run pr main feature-branch
```

This will guide you through the process of creating a pull request, including:
- Verifying the branch exists
- Setting up PR details
- Answering flow questions
- Generating PR description

If you run `npm run pr` without arguments, it will display a list of available tasks to create PRs for.

## Configuration

- `.env`: Contains environment variables for Bitbucket authentication and project paths.
- `repositoryMap.json`: Maps system names to Bitbucket repository names.
- `customTests.json`: An array of tests which can be executed as part of the PR flow
- `customFlowQuestions.json`: An array of questions which can be asked as part of the PR flow

## Scripts

- `npm run tasks`: Runs the Task Builder
- `npm run tasks {system}`: Runs the Task Builder with the specified system
- `npm run tasks list`: Lists all tasks and allows actions to be run
- `npm run pr`: Runs the interactive PR Builder, allowing you to select a task to PR
- `npm run pr <system> <branch-name>`: Runs the PR Builder manually for the specified system and branch

## Contributing

Contributions to Task Master are welcome.

## License

This project is licensed under the MIT licence.

## Support

If you encounter any problems or have suggestions, please open an issue in the GitHub repository.
