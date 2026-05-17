import { Hono } from 'hono';
import { reddit, redis } from '@devvit/web/server';

export const scheduler = new Hono();

const SUBREDDITS = ['all', 'forhire', 'freelance', 'webdev'];

const SEARCH_TERMS = [
  'need website',
  'need a website',
  'need site',
  'build website',
  'make me a website',
];

export async function runGigCheck() {
  console.log(`🚀 Running native SDK gig check at ${new Date().toISOString()}`);

  let activeSubs = [...SUBREDDITS];
  try {
    const currentSub = await reddit.getCurrentSubreddit();
    if (currentSub && currentSub.name) {
      activeSubs.push(currentSub.name);
    }
  } catch (subErr) {
    // Fallback if getCurrentSubreddit fails (e.g. running in context where it's not bound)
  }

  // Remove duplicates from the active list
  activeSubs = Array.from(new Set(activeSubs));

  for (const subreddit of activeSubs) {

    try {
      console.log(`Scanning r/${subreddit}...`);

      // Fetch newest 25 posts from each target subreddit
      const posts = await reddit
        .getNewPosts({
          subredditName: subreddit,
          limit: 25,
        })
        .all();

      for (const post of posts) {
        // Step 1: Scan Post Title & Body
        const postTitle = (post.title || '').toLowerCase();
        const postBody = (post.body || '').toLowerCase();

        let isMatch = false;
        let matchedText = '';

        for (const term of SEARCH_TERMS) {
          if (postTitle.includes(term) || postBody.includes(term)) {
            isMatch = true;
            matchedText = term;
            break;
          }
        }

        // Step 2: Handle Match for Post Author
        if (isMatch) {
          const author = post.authorName;
          if (!author || author === '[deleted]') continue;

          // Unique ID to track this post
          const itemId = post.id;

          // Check if we already messaged this post
          const alreadySent = await redis.get(`sent:${itemId}`);
          if (!alreadySent) {
            // Add small random delay to avoid rate limits (2-5 seconds)
            const delay = Math.floor(Math.random() * 3000) + 2000;
            await new Promise((resolve) => setTimeout(resolve, delay));

            // Send DM
            await reddit.sendPrivateMessage({
              to: author,
              subject: 'Hi',
              text: 'Hi',
            });

            // Cache for 30 days
            await redis.set(`sent:${itemId}`, '1', {
              expiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            });

            console.log(
              `✅ Sent "Hi" to ${author} for matching post (Keyword: "${matchedText}"): ${post.title}`
            );
          }
        }

        // Step 3: Scan Post Comments (if any comments exist)
        if (post.numberOfComments > 0) {
          try {
            const comments = await reddit
              .getComments({
                postId: post.id,
                limit: 10,
              })
              .all();

            for (const comment of comments) {
              const commentBody = (comment.body || '').toLowerCase();
              let isCommentMatch = false;
              let matchedCommentText = '';

              for (const term of SEARCH_TERMS) {
                if (commentBody.includes(term)) {
                  isCommentMatch = true;
                  matchedCommentText = term;
                  break;
                }
              }

              if (isCommentMatch) {
                const commentAuthor = comment.authorName;
                if (!commentAuthor || commentAuthor === '[deleted]') continue;

                const commentItemId = comment.id;

                const commentAlreadySent = await redis.get(
                  `sent:${commentItemId}`
                );

                if (!commentAlreadySent) {
                  // Add small random delay
                  const delay = Math.floor(Math.random() * 3000) + 2000;
                  await new Promise((resolve) => setTimeout(resolve, delay));

                  await reddit.sendPrivateMessage({
                    to: commentAuthor,
                    subject: 'Hi',
                    text: 'Hi',
                  });

                  await redis.set(`sent:${commentItemId}`, '1', {
                    expiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                  });

                  console.log(
                    `✅ Sent "Hi" to ${commentAuthor} for matching comment (Keyword: "${matchedCommentText}") in thread: ${post.title}`
                  );
                }
              }
            }
          } catch (commentErr) {
            // Ignore comment fetching errors for individual posts
          }
        }
      }
    } catch (err) {
      console.error(`Error scanning r/${subreddit}:`, err);
    }
  }

  console.log('✅ Gig check completed');
}

scheduler.post('/check-gigs', async (c) => {
  await runGigCheck();
  return c.json({ success: true }, 200);
});
