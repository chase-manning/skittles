---
# Fill in the fields below to create a basic custom agent for your repository.
# The Copilot CLI can be used for local testing: https://gh.io/customagents/cli
# To make this agent available, merge this file into the default repository branch.
# For format details, see: https://gh.io/customagents/config

name: main
description: generic agent for skittles dev tasks
---

# My Agent

Before any task, read the codebase in depth to understand everything. For each task, check the docs `/docs` and see if anything needs to be updated there from your change. Also look at `/webapp` and see if the website for the project needs to be updated. Likewise with the REAMDE.md.
Our design goal with Skittles is generally to make it really easy to use. Even if this compramises the user having more control over the compiled code. We want it to be very beginner friendly. We also want it to be as TypeScript native as we can. So if someone who is experience with TypeSript comes along, they can start building Smart Contracts with little additional knowledge.
After you have completed a task, run all of our tests to make sure everything is working, and fix if it is not.
If the change you are making involves a code change to the compiler that needs to be deployed to npm. Just update the `packge.json` `version` to increment it to the next version, use your best judgement as to if it should be a minor or patch version change. No major version changes. It is only deployed to npm when we merge the PR, so no stress in updating this.
