# Comprehensive Guide to Gerrit Changes REST API

This document offers a detailed overview of the Gerrit Changes REST API, combining insights from both contemporary and older API versions to provide a full spectrum of change management functionalities.

## Base URL Structure

All change-related endpoints are structured as follows:

`/changes/{change-id}/...`

The `{change-id}` can be represented in several ways:

*   `<project>~<changeNumber>` (Recommended for modern versions)
*   `<project>~<branch>~<Change-Id>`
*   A unique Change-Id
*   A unique numeric change number (legacy)

## Core Operations on Changes

### Querying Changes

`GET /changes/?q={query}&n={limit}`

You can query for changes using these optional parameters:

*   `q`: A query string, for instance, `status:open+is:watched`.
*   `n`: The maximum number of results to return.
*   `o`: Specifies additional data fields to include (see [Query Options](#query-options)).
*   `N`: A legacy parameter to resume a query with a sortkey.
*   `P`: A legacy parameter for reverse direction pagination.

**Multi-query Example:**

`GET /changes/?q=is:open+owner:self&q=is:open+reviewer:self+-owner:self`

This returns an array of arrays, with each inner array corresponding to a query.

### Retrieving Change Details

`GET /changes/{change-id}`
`GET /changes/{change-id}/detail`

The `/detail` endpoint provides a more comprehensive response, including labels, detailed account information, reviewer updates, and change messages.

### Managing Change State

#### Abandoning and Restoring Changes

`POST /changes/{change-id}/abandon`
`POST /changes/{change-id}/restore`

An optional message can be included in the request body:

```json
{
  "message": "Reason for abandoning this change."
}
```

#### Submitting a Change

`POST /changes/{change-id}/submit`

The request can include options like:

```json
{
  "wait_for_merge": true,
  "on_behalf_of": "account-id"
}
```

#### Work-in-Progress and Private Changes

*   **Work-in-Progress**:
    *   `POST /changes/{change-id}/wip` (Mark as WIP)
    *   `POST /changes/{change-id}/ready` (Mark as ready for review)
*   **Private Changes**:
    *   `POST /changes/{change-id}/private` (Mark as private)
    *   `DELETE /changes/{change-id}/private` (Unmark as private)

#### Legacy Draft Changes

*   `POST /changes/{change-id}/publish` (Publish a draft)
*   `DELETE /changes/{change-id}` (Delete a draft)

### Topic Management

*   `GET /changes/{change-id}/topic` (Get the topic)
*   `PUT /changes/{change-id}/topic` (Set the topic)
*   `DELETE /changes/{change-id}/topic` (Delete the topic)

## Reviewers and Reviews

### Managing Reviewers

*   `GET /changes/{change-id}/reviewers/`
*   `POST /changes/{change-id}/reviewers`
*   `DELETE /changes/{change-id}/reviewers/{account-id}`
*   `GET /changes/{change-id}/suggest_reviewers?q={query}` (Suggest reviewers)

**Add Reviewer Request:**

```json
{
  "reviewer": "john.doe@example.com",
  "state": "REVIEWER"
}
```

### Setting a Review

`POST /changes/{change-id}/revisions/{revision-id}/review`

**Comprehensive Review Request:**

```json
{
  "message": "This looks good, but please address the inline comments.",
  "labels": { "Code-Review": 1 },
  "comments": {
    "path/to/file.java": [{
      "line": 23,
      "message": "This variable name could be more descriptive."
    }]
  },
  "drafts": "PUBLISH",
  "notify": "OWNER_REVIEWERS"
}
```

## Revision and File Operations

### Getting Revision Information

*   `GET /changes/{change-id}/revisions/{revision-id}/commit`
*   `GET /changes/{change-id}/revisions/{revision-id}/files/`
*   `GET /changes/{change-id}/revisions/{revision-id}/patch`

### Rebase and Cherry-Pick

*   **Rebase**: `POST /changes/{change-id}/rebase`
*   **Cherry-Pick**: `POST /changes/{change-id}/revisions/{revision-id}/cherrypick`

### File Content and Diffs

*   `GET /changes/{change-id}/revisions/{revision-id}/files/{file-id}/content`
*   `GET /changes/{change-id}/revisions/{revision-id}/files/{file-id}/diff`

### Managing File Review Status

*   `PUT /changes/{change-id}/revisions/{revision-id}/files/{file-id}/reviewed`
*   `DELETE /changes/{change-id}/revisions/{revision-id}/files/{file-id}/reviewed`

## Advanced Operations

### Attention Set

*   `GET /changes/{change-id}/attention` (List users in the attention set)
*   `POST /changes/{change-id}/attention` (Add a user to the attention set)
*   `DELETE /changes/{change-id}/attention/{account-id}` (Remove a user)

### Change and Commit Message Edits

*   **Change Edit**: `PUT /changes/{change-id}/edit/path%2fto%2ffile`
*   **Commit Message**: `PUT /changes/{change-id}/message`

## Query Options

### Legacy API Options

*   `LABELS`: Summary of labels and approvals.
*   `DETAILED_LABELS`: Detailed label information.
*   `CURRENT_REVISION`: Details of the current revision.
*   `ALL_REVISIONS`: Details for all revisions.
*   `DOWNLOAD_COMMANDS`: Fetch commands.
*   `CURRENT_FILES`: List of files in the current revision.

### Modern API Options

*   `SUBMIT_REQUIREMENTS`: Information about submit requirements.
*   `REVIEWER_UPDATES`: History of reviewer updates.
*   `CHANGE_ACTIONS`: Available change-level actions.
*   `SUBMITTABLE`: Submittability status.

## Response Formats and Error Handling

### Change Entity Example

```json
{
  "id": "myProject~master~I123abc",
  "project": "myProject",
  "branch": "master",
  "subject": "New Feature",
  "status": "NEW",
  "owner": { "_account_id": 12345, "name": "John Doe" },
  "labels": {
    "Code-Review": {
      "all": [{ "value": 1, "_account_id": 12345 }],
      "values": { " 0": "No score", "+1": "Looks good" }
    }
  }
}
```

### Common HTTP Status Codes

*   `200 OK`: Success.
*   `201 Created`: Resource created.
*   `400 Bad Request`: Invalid request.
*   `403 Forbidden`: Insufficient permissions.
*   `404 Not Found`: Resource not found.
*   `409 Conflict`: The operation conflicts with the current state of the resource.

## Version Compatibility and Best Practices

### API Evolution

The Gerrit API has evolved, with modern versions introducing features like the attention set, change edits, and a more structured submit requirement system, while legacy versions relied on a simpler draft and review model.

### Migration Notes

When moving from older to newer versions of the API, consider that:

*   Pagination has shifted from `_sortkey` to a token-based system.
*   The draft change workflow has been replaced by the Work-in-Progress (WIP) state.

### Best Practices

*   Use the recommended `<project>~<changeNumber>` format for change IDs.
*   Limit the scope of your queries and selectively request fields to improve performance.
*   Handle API responses defensively, checking for HTTP status codes and error messages.
*   Be mindful of version differences when working with features like pagination and draft changes.

---

For more information, see the official [Gerrit REST API documentation for changes](https://gerrit-documentation.storage.googleapis.com/Documentation/2.8/rest-api-changes.html).