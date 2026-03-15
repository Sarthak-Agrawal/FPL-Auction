-- FPL Auction teams+players seed
-- Generated at: 2026-03-15T11:08:21.267699+00:00
PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

-- Reset exported tables
DELETE FROM player;
DELETE FROM team;
DELETE FROM sqlite_sequence WHERE name IN ('player', 'team');

-- team rows: 6
INSERT INTO team (id, name, budget_total, budget_remaining, created_at) VALUES (1, 'A', 1000.0, 1000.0, '2026-03-15 10:39:13.380967');
INSERT INTO team (id, name, budget_total, budget_remaining, created_at) VALUES (2, 'B', 1000.0, 1000.0, '2026-03-15 10:39:13.381256');
INSERT INTO team (id, name, budget_total, budget_remaining, created_at) VALUES (3, 'Sarthak IT', 1000000000.0, 1000000000.0, '2026-03-15 10:55:52.284053');
INSERT INTO team (id, name, budget_total, budget_remaining, created_at) VALUES (4, 'Sarthak COE', 1000000000.0, 1000000000.0, '2026-03-15 10:56:02.931801');
INSERT INTO team (id, name, budget_total, budget_remaining, created_at) VALUES (5, 'Kohli', 1000000000.0, 1000000000.0, '2026-03-15 10:56:08.318345');
INSERT INTO team (id, name, budget_total, budget_remaining, created_at) VALUES (6, 'Sahoo', 1000000000.0, 1000000000.0, '2026-03-15 10:56:14.700405');

-- player rows: 1
INSERT INTO player (id, name, role, base_price, nationality, ipl_team, status, sold_to_team_id, sold_price) VALUES (1, 'P1', 'batsman', 100.0, NULL, NULL, 'pending', NULL, NULL);

COMMIT;
PRAGMA foreign_keys = ON;
