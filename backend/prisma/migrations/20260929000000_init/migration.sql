-- CreateSchema
-- CreateEnum
CREATE TYPE "FarmerRole" AS ENUM ('farmer', 'admin');

-- CreateEnum
CREATE TYPE "HarvestMaturityStage" AS ENUM ('Immature', 'Mature', 'Semi-Ripe', 'Fully Ripe', 'Over-Ripe');

-- CreateEnum
CREATE TYPE "HarvestStatus" AS ENUM ('Active', 'Sold', 'Spoiled', 'Archived');

-- CreateEnum
CREATE TYPE "SensorSource" AS ENUM ('esp32', 'manual', 'simulator');

-- CreateEnum
CREATE TYPE "SpoilageRisk" AS ENUM ('Low', 'Medium', 'High');

-- CreateEnum
CREATE TYPE "PredictionSource" AS ENUM ('ml_model', 'rule_based', 'pending');

-- CreateEnum
CREATE TYPE "RecommendationAction" AS ENUM ('Sell Today', 'Wait for Better Price', 'Transport to Another Market', 'Move Produce to Storage', 'Insufficient Data');

-- CreateEnum
CREATE TYPE "RecommendationDecision" AS ENUM ('SELL_TODAY', 'WAIT', 'MOVE_PRODUCE', 'INSUFFICIENT_DATA');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('actionable', 'insufficient_data');

-- CreateEnum
CREATE TYPE "QualityGrade" AS ENUM ('Excellent', 'Good', 'Fair', 'Poor', 'Unknown');

-- CreateEnum
CREATE TYPE "SaleabilityStatus" AS ENUM ('SALEABLE', 'BORDERLINE', 'NOT_SALEABLE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "VisibleSpoilage" AS ENUM ('NONE', 'PARTIAL', 'SEVERE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ObserverSource" AS ENUM ('farmer', 'field_agent', 'device', 'manual', 'other');

-- CreateEnum
CREATE TYPE "LabelConfidence" AS ENUM ('confirmed', 'probable', 'uncertain');

-- CreateEnum
CREATE TYPE "FeedbackSaleStatus" AS ENUM ('Sold', 'Not Sold', 'Spoiled', 'Stored', 'Discarded', 'Not Reported');

-- CreateEnum
CREATE TYPE "SpoilageOutcome" AS ENUM ('No Spoilage', 'Partial Spoilage', 'Full Spoilage', 'Not Reported');

-- CreateEnum
CREATE TYPE "FeedbackQuality" AS ENUM ('Excellent', 'Good', 'Fair', 'Poor', 'Not Reported');

-- CreateEnum
CREATE TYPE "MarketType" AS ENUM ('APMC', 'Local', 'Wholesale', 'Retail', 'Other');

-- CreateEnum
CREATE TYPE "PriceUnit" AS ENUM ('kg', 'quintal', 'tonne');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('warning', 'danger', 'info', 'success');

-- CreateTable
CREATE TABLE "farmers" (
    "_id" VARCHAR(24) NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" VARCHAR(10) NOT NULL,
    "location" TEXT,
    "village" TEXT,
    "district" TEXT,
    "state" TEXT,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'English',
    "role" "FarmerRole" NOT NULL DEFAULT 'farmer',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedDate" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "__v" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "farmers_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "devices" (
    "_id" VARCHAR(24) NOT NULL,
    "deviceId" TEXT NOT NULL,
    "farmerId" VARCHAR(24) NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "__v" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "harvests" (
    "_id" VARCHAR(24) NOT NULL,
    "farmerId" VARCHAR(24) NOT NULL,
    "crop" TEXT NOT NULL,
    "variety" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "initialWeight" DOUBLE PRECISION,
    "harvestDate" TIMESTAMPTZ(3) NOT NULL,
    "harvestTime" TEXT,
    "maturityStage" "HarvestMaturityStage",
    "storageType" TEXT,
    "storageCondition" TEXT,
    "farmerLocation" TEXT,
    "status" "HarvestStatus" NOT NULL DEFAULT 'Active',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "__v" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "harvests_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "sensor_readings" (
    "_id" VARCHAR(24) NOT NULL,
    "harvestId" VARCHAR(24) NOT NULL,
    "farmerId" VARCHAR(24) NOT NULL,
    "temperature" DOUBLE PRECISION,
    "humidity" DOUBLE PRECISION,
    "ethylene" DOUBLE PRECISION,
    "voc" DOUBLE PRECISION,
    "co2" DOUBLE PRECISION,
    "currentWeight" DOUBLE PRECISION,
    "source" "SensorSource" NOT NULL DEFAULT 'manual',
    "deviceId" TEXT,
    "timestamp" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "__v" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sensor_readings_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "predictions" (
    "_id" VARCHAR(24) NOT NULL,
    "harvestId" VARCHAR(24) NOT NULL,
    "farmerId" VARCHAR(24) NOT NULL,
    "sensorReadingId" VARCHAR(24),
    "remainingShelfLife" DOUBLE PRECISION,
    "shelfLifeUnit" TEXT NOT NULL DEFAULT 'days',
    "shelfLifeConfidence" DOUBLE PRECISION,
    "shelfLifeModelVersion" TEXT,
    "shelfLifeModelSource" TEXT,
    "shelfLifePredictedAt" TIMESTAMPTZ(3),
    "spoilageRisk" "SpoilageRisk",
    "spoilageRiskConfidence" DOUBLE PRECISION,
    "featuresUsed" JSONB,
    "modelVersion" TEXT,
    "predictedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "PredictionSource" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "__v" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "predictions_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "_id" VARCHAR(24) NOT NULL,
    "harvestId" VARCHAR(24) NOT NULL,
    "farmerId" VARCHAR(24) NOT NULL,
    "predictionId" VARCHAR(24),
    "action" "RecommendationAction" NOT NULL,
    "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "decision" "RecommendationDecision",
    "decisionStatus" "RecommendationStatus",
    "confidence" DOUBLE PRECISION,
    "marketsConsidered" JSONB NOT NULL DEFAULT '[]',
    "bestMarketId" VARCHAR(24),
    "remainingShelfLife" DOUBLE PRECISION,
    "spoilageRisk" TEXT,
    "quantity" DOUBLE PRECISION,
    "shelfLife" JSONB,
    "dataQuality" JSONB,
    "generatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "__v" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "quality_observations" (
    "_id" VARCHAR(24) NOT NULL,
    "harvestId" VARCHAR(24) NOT NULL,
    "farmerId" VARCHAR(24) NOT NULL,
    "qualityGrade" "QualityGrade" NOT NULL DEFAULT 'Unknown',
    "saleabilityStatus" "SaleabilityStatus" NOT NULL DEFAULT 'UNKNOWN',
    "visibleSpoilage" "VisibleSpoilage" NOT NULL DEFAULT 'UNKNOWN',
    "firmness" TEXT,
    "colorRipeness" TEXT,
    "odorNote" TEXT,
    "observerSource" "ObserverSource" NOT NULL DEFAULT 'farmer',
    "labelConfidence" "LabelConfidence" NOT NULL DEFAULT 'confirmed',
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "isEndOfSaleableLife" BOOLEAN NOT NULL DEFAULT false,
    "endOfSaleableLifeTimestamp" TIMESTAMPTZ(3),
    "comments" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "__v" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quality_observations_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "farmer_feedback" (
    "_id" VARCHAR(24) NOT NULL,
    "farmerId" VARCHAR(24) NOT NULL,
    "harvestId" VARCHAR(24) NOT NULL,
    "predictionId" VARCHAR(24),
    "recommendationId" VARCHAR(24),
    "farmerAction" TEXT,
    "actualSaleStatus" "FeedbackSaleStatus" NOT NULL DEFAULT 'Not Reported',
    "actualSellingPrice" DOUBLE PRECISION,
    "actualMarket" TEXT,
    "soldQuantity" DOUBLE PRECISION,
    "spoiledQuantity" DOUBLE PRECISION,
    "actualSpoilageOutcome" "SpoilageOutcome" NOT NULL DEFAULT 'Not Reported',
    "actualQuality" "FeedbackQuality" NOT NULL DEFAULT 'Not Reported',
    "recommendationHelpful" BOOLEAN,
    "recommendationFollowed" BOOLEAN,
    "predictionAccurate" BOOLEAN,
    "observedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comments" TEXT,
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "__v" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "farmer_feedback_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "markets" (
    "_id" VARCHAR(24) NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "city" TEXT,
    "district" TEXT,
    "state" TEXT,
    "marketType" "MarketType" NOT NULL DEFAULT 'Local',
    "supportedCrops" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coordinates" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "distance" DOUBLE PRECISION,
    "travelTime" TEXT,
    "travelTimeHours" DOUBLE PRECISION,
    "transportCost" DOUBLE PRECISION,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "__v" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "market_prices" (
    "_id" VARCHAR(24) NOT NULL,
    "marketId" VARCHAR(24) NOT NULL,
    "crop" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "unit" "PriceUnit" NOT NULL DEFAULT 'kg',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "observedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "variety" TEXT,
    "date" TIMESTAMPTZ(3),
    "minPrice" DOUBLE PRECISION,
    "maxPrice" DOUBLE PRECISION,
    "modalPrice" DOUBLE PRECISION,
    "arrivalQuantity" DOUBLE PRECISION,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "__v" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "market_prices_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "_id" VARCHAR(24) NOT NULL,
    "farmerId" VARCHAR(24) NOT NULL,
    "harvestId" VARCHAR(24),
    "type" "NotificationType" NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "channels" JSONB NOT NULL DEFAULT '{"inApp":true,"sms":false,"whatsapp":false,"push":false}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "__v" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "otps" (
    "_id" VARCHAR(24) NOT NULL,
    "mobile" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "__v" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "otps_pkey" PRIMARY KEY ("_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "farmers_mobile_key" ON "farmers"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "devices_deviceId_key" ON "devices"("deviceId");

-- CreateIndex
CREATE INDEX "devices_deviceId_isActive_idx" ON "devices"("deviceId", "isActive");

-- CreateIndex
CREATE INDEX "devices_farmerId_idx" ON "devices"("farmerId");

-- CreateIndex
CREATE INDEX "harvests_farmerId_idx" ON "harvests"("farmerId");

-- CreateIndex
CREATE INDEX "sensor_readings_harvestId_timestamp_idx" ON "sensor_readings"("harvestId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "sensor_readings_farmerId_idx" ON "sensor_readings"("farmerId");

-- CreateIndex
CREATE UNIQUE INDEX "sensor_readings_deviceId_timestamp_key" ON "sensor_readings"("deviceId", "timestamp") NULLS NOT DISTINCT;

-- CreateIndex
CREATE INDEX "predictions_harvestId_predictedAt_idx" ON "predictions"("harvestId", "predictedAt" DESC);

-- CreateIndex
CREATE INDEX "predictions_farmerId_idx" ON "predictions"("farmerId");

-- CreateIndex
CREATE INDEX "predictions_sensorReadingId_idx" ON "predictions"("sensorReadingId");

-- CreateIndex
CREATE INDEX "recommendations_harvestId_idx" ON "recommendations"("harvestId");

-- CreateIndex
CREATE INDEX "recommendations_farmerId_idx" ON "recommendations"("farmerId");

-- CreateIndex
CREATE INDEX "recommendations_predictionId_idx" ON "recommendations"("predictionId");

-- CreateIndex
CREATE INDEX "recommendations_bestMarketId_idx" ON "recommendations"("bestMarketId");

-- CreateIndex
CREATE INDEX "quality_observations_harvestId_observedAt_idx" ON "quality_observations"("harvestId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "quality_observations_farmerId_idx" ON "quality_observations"("farmerId");

-- CreateIndex
CREATE UNIQUE INDEX "quality_observations_harvestId_observedAt_key" ON "quality_observations"("harvestId", "observedAt");

-- CreateIndex
CREATE INDEX "farmer_feedback_farmerId_idx" ON "farmer_feedback"("farmerId");

-- CreateIndex
CREATE INDEX "farmer_feedback_harvestId_idx" ON "farmer_feedback"("harvestId");

-- CreateIndex
CREATE INDEX "farmer_feedback_predictionId_idx" ON "farmer_feedback"("predictionId");

-- CreateIndex
CREATE INDEX "farmer_feedback_recommendationId_idx" ON "farmer_feedback"("recommendationId");

-- CreateIndex
CREATE INDEX "market_prices_marketId_crop_observedAt_idx" ON "market_prices"("marketId", "crop", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "market_prices_crop_observedAt_idx" ON "market_prices"("crop", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "market_prices_marketId_idx" ON "market_prices"("marketId");

-- CreateIndex
CREATE INDEX "notifications_farmerId_read_createdAt_idx" ON "notifications"("farmerId", "read", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_harvestId_idx" ON "notifications"("harvestId");

-- CreateIndex
CREATE INDEX "otps_expiresAt_idx" ON "otps"("expiresAt");

-- CreateIndex
CREATE INDEX "otps_mobile_used_idx" ON "otps"("mobile", "used");
