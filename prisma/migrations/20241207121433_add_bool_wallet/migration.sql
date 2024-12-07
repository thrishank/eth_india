/*
  Warnings:

  - Added the required column `walletCreated` to the `UserAuth` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserAuth" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "authToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "deviceToken" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "walletCreated" BOOLEAN NOT NULL
);
INSERT INTO "new_UserAuth" ("authToken", "deviceToken", "id", "refreshToken", "updatedAt", "userId") SELECT "authToken", "deviceToken", "id", "refreshToken", "updatedAt", "userId" FROM "UserAuth";
DROP TABLE "UserAuth";
ALTER TABLE "new_UserAuth" RENAME TO "UserAuth";
CREATE UNIQUE INDEX "UserAuth_userId_key" ON "UserAuth"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
