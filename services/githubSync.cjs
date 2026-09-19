// services/githubSync.cjs
//
// GitHub Contents API commit helper. Lets environments without a `git` binary
// or a writable filesystem (Vercel serverless, CI runners, etc.) commit a
// modified file back to a GitHub repository.
//
// Shared by both the local Express server (server.cjs) and the Vercel handler
// (api/_handlers/git-operations.ts) — CommonJS so `require()` works in the
// Express process and dynamic `import()` works from the bundler.
//
// Required env vars (set in .env locally or Vercel dashboard in production):
//   - GITHUB_TOKEN: a personal access token or fine-grained token with
//                   `contents:write` scope on the target repo.
//   - REPO_OWNER:    the GitHub org or user that owns the repo.
//   - REPO_NAME:     the repo name.
// Optional env vars:
//   - GITHUB_BRANCH: branch to commit to. Defaults to "main".

const { Buffer } = require('buffer');

async function syncFileOnGitHub(filePath, modifierCallback, commitMessage, retryCount) {
    if (typeof retryCount !== 'number') retryCount = 1;
    const env = process.env;
    const GITHUB_TOKEN = env.GITHUB_TOKEN;
    const REPO_OWNER = env.REPO_OWNER;
    const REPO_NAME = env.REPO_NAME;
    const GITHUB_BRANCH = env.GITHUB_BRANCH;

    if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
        const missing = ['GITHUB_TOKEN', 'REPO_OWNER', 'REPO_NAME'].filter(function (k) { return !env[k]; });
        throw Object.assign(
            new Error('Sync requires these env vars on this server: ' + missing.join(', ') + '. Also ensure GITHUB_TOKEN has contents:write scope (fine-grained PAT) or repo scope (classic PAT) on the target repo. Add the env vars to .env (locally) or the Vercel project settings (production), then restart / redeploy.'),
            { status: 503, missing: missing }
        );
    }

    const branch = GITHUB_BRANCH || 'main';
    const url = 'https://api.github.com/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/' + filePath;
    const headers = {
        'Authorization': 'Bearer ' + GITHUB_TOKEN,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Coalition-Admin-Sync',
    };

    // 1. Fetch the current file so we can (a) compare content for noChanges
    // detection and (b) get the blob SHA GitHub needs for the PUT update.
    const getRes = await fetch(url + '?ref=' + branch, { headers: headers });
    if (!getRes.ok) {
        if (getRes.status === 404) {
            throw Object.assign(
                new Error('GitHub repo or file not found. Check REPO_OWNER / REPO_NAME env vars and that the token has access to the repo.'),
                { status: 502 }
            );
        }
        if (getRes.status === 401) {
            throw Object.assign(new Error('GITHUB_TOKEN is invalid or expired.'), { status: 502 });
        }
        throw Object.assign(new Error('GitHub API GET failed: ' + getRes.statusText), { status: 502 });
    }

    const fileData = await getRes.json();
    const sha = fileData.sha;
    if (!sha) {
        throw Object.assign(
            new Error('GitHub returned no file sha for the existing constants.ts. Cannot update without the upstream blob reference.'),
            { status: 502 }
        );
    }
    // Defensive: the Contents API only returns base64-encoded content for text
    // files under the inline size limit. For oversized / binary responses
    // (encoding something other than base64) we refuse to proceed rather than
    // silently corrupt the file by handing a null/wrong-encoded buffer to the
    // modifier.
    if (fileData.encoding && fileData.encoding !== 'base64') {
        if (fileData.encoding === 'none') {
            throw Object.assign(
                new Error('constants.ts exceeds the GitHub Contents API inline size limit (>1 MB). Use the Git Data API or a different sync strategy.'),
                { status: 413 }
            );
        }
        throw Object.assign(
            new Error('GitHub returned an unsupported encoding (' + fileData.encoding + '). Cannot sync this file via the Contents API.'),
            { status: 422 }
        );
    }
    // Defensive: GH Contents API normally pairs encoding=base64 with content,
    // but a transient backend failure could return a null content field that
    // would crash Buffer.from(null, 'base64') further down.
    if (fileData.encoding === 'base64' && !fileData.content) {
        throw Object.assign(
            new Error('GitHub returned no file content for constants.ts despite base64 encoding. Cannot decode.'),
            { status: 502 }
        );
    }
    const currentContent = fileData.encoding === 'base64'
        ? Buffer.from(fileData.content, 'base64').toString('utf8')
        : fileData.content;

    // 2. Apply the in-place modifier and short-circuit if nothing changed.
    const newContent = modifierCallback(currentContent);
    if (typeof newContent !== 'string') {
        throw Object.assign(
            new Error('File modifier did not return a string. The sync pipeline is broken — check the modifier logic.'),
            { status: 500 }
        );
    }
    if (currentContent === newContent) {
        return { noChanges: true, hash: sha };
    }

    // 3. PUT the new content with the prior SHA — GitHub refuses to update a
    // file without it (a safeguard against concurrent edits).
    const putRes = await fetch(url, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify({
            message: commitMessage || 'Sync products from Supabase',
            content: Buffer.from(newContent, 'utf8').toString('base64'),
            sha: sha,
            branch: branch,
        }),
    });

    if (!putRes.ok) {
        if (putRes.status === 409 && retryCount > 0) {
            // Concurrent edit — re-fetch the new SHA and try once more.
            return await syncFileOnGitHub(filePath, modifierCallback, commitMessage, retryCount - 1);
        }
        throw Object.assign(
            new Error('GitHub API PUT failed: ' + putRes.statusText),
            { status: putRes.status === 409 ? 409 : 502 }
        );
    }

    const putData = await putRes.json();
    return { success: true, hash: (putData.commit && putData.commit.sha) || sha };
}

module.exports = { syncFileOnGitHub };
