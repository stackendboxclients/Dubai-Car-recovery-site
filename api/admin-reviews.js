// Legacy endpoint retained as a non-functional tombstone so older links do not
// expose moderation controls. Customer feedback now publishes automatically.
export default function handler(_req,res) {
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Robots-Tag','noindex, nofollow');
 res.status(410).json({error:'The review approval workflow has been removed.'});
}
