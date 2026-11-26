CREATE TABLE account_simulations (
  owner_key text NOT NULL,
  simulation_id text NOT NULL CHECK (simulation_id ~ '^[a-f0-9]{32}$'),
  project jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (owner_key, simulation_id)
);

CREATE TABLE account_land_profiles (
  owner_key text PRIMARY KEY,
  revision uuid NOT NULL,
  profile jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
