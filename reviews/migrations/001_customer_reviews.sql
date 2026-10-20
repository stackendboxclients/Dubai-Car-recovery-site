CREATE TABLE IF NOT EXISTS customer_reviews (
  id uuid PRIMARY KEY,
  customer_name varchar(80) NOT NULL CHECK (char_length(customer_name) BETWEEN 2 AND 80),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text text NOT NULL CHECK (char_length(review_text) BETWEEN 10 AND 3000),
  submission_hash text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'customer_submission' CHECK (source = 'customer_submission'),
  status text NOT NULL DEFAULT 'published' CHECK (status = 'published'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_reviews_public_newest
  ON customer_reviews (created_at DESC, id DESC)
  WHERE status = 'published' AND source = 'customer_submission';
