/*
  Warnings:

  - You are about to drop the column `isAI` on the `UserState` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_UserState" ("context", "id", "stage", "updatedAt", "userId") SELECT "context", "id", "stage", "updatedAt", "userId" FROM "UserState";
DROP TABLE "UserState";
ALTER TABLE "new_UserState" RENAME TO "UserState";
CREATE UNIQUE INDEX "UserState_userId_key" ON "UserState"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
