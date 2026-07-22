-- The product has only CUSTOMER and ORGANIZER roles. Abort explicitly if
-- legacy ADMIN data exists so no account is converted or removed silently.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "users" WHERE "user_role"::text = 'ADMIN') THEN
    RAISE EXCEPTION 'Cannot remove ADMIN role while ADMIN users still exist';
  END IF;
END $$;

ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ORGANIZER');

ALTER TABLE "users"
  ALTER COLUMN "user_role" DROP DEFAULT,
  ALTER COLUMN "user_role" TYPE "UserRole"
    USING ("user_role"::text::"UserRole"),
  ALTER COLUMN "user_role" SET DEFAULT 'CUSTOMER';

DROP TYPE "UserRole_old";
