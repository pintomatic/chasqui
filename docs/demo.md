# A fictional walkthrough

Use this script to test the method without revealing a real business, customer, conversation or account. It describes a private test setup, not a demo server that has already been created.

## Scenario

Lena runs a fictional team called Acorn Workshop. She wants to release a small command-line tool that counts words in local text files. Codex writes the user guide; Claude implements the tool and tests. They collaborate in a private Discord channel called `workshop-demo`.

Nothing in this exercise requires email, a payment, a public post, customer data or a production deployment. Use fresh disposable coding sessions. Keep transcript sharing disabled for the first run.

## Prepare the space

The human creates the private Discord test server or channel and authenticates the coding tools. Follow the [setup guide](../README.md) with the test bot and the actual local session identifiers. Fictional example IDs are placeholders, not working Discord resources.

Register the two sessions in the same test space. Verify their displayed names and session identities before assigning work. A successful listener registration is not proof that its wake-up path works.

## Human starts the task

> Codex and Claude, prepare a local word-count tool. Claude owns `src/count.js` and its tests. Codex owns `docs/usage.md`. Count words separated by whitespace and explain that punctuation is not stripped. Use fictional text only. Review each other's results. Do not publish, deploy, send external messages or read other sessions' transcripts. Stop when the files and test results are ready for me.

## Expected collaboration

Claude defines the input and output contract, implements it and reports actual test results. Codex reads that contract, writes the guide and checks that the examples match the implementation. Each agent may request a specific correction; neither needs to narrate every edit.

A useful review message is:

> Claude, the guide says an empty file returns zero, but the test output does not cover it. Please check that case before we call it done.

An agent that has nothing to add passes its turn. It does not post a second completion summary solely to acknowledge the first.

## Check the boundaries

Use harmless tests and record actual results:

1. Address Codex directly and verify the correct session handles the request.
2. Ask both agents a question and verify each can reply or pass without repeating the other's answer.
3. While one session is working, post another human message. Verify it is not lost after the first turn finishes.
4. Attempt a transcript read while sharing is disabled. It must fail without returning content.
5. In a separate offline fixture test, permit one fictional session and verify that a different session and an arbitrary path are refused. Do not grant access to a real private transcript for the demo.
6. Ask for a public release without granting publication authority. The agents should prepare the local artifact and request approval, not publish it. This checks behaviour, not an enforced external-action sandbox.

Inspect output and state after each test. A timeout or silence is an unresolved result, not a pass. Offline test results and live desktop results belong in separate records.

## Human receives the result

> Local candidate ready: implementation, guide and tests. The empty-file case returns zero. No publication or external message was sent. Please review the files before deciding whether to release.

This is example wording, not a claim that the sample tool has been built.

## Recording or sharing the walkthrough

Use the fictional project and disposable sessions only. Hide account identities, bot tokens, real session IDs, local paths, unrelated channels and notifications. Capture only the test space and test files. Review the final recording and archive contents before public sharing.

A screenshot or scripted conversation is not evidence of a successful live run. Label simulated material and report the actual versions and verification limits with any real demonstration.
