
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `AdminAuditLogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `AdminAuditLogs` (
  `LogId` int unsigned NOT NULL AUTO_INCREMENT,
  `AdminId` int unsigned DEFAULT NULL,
  `Action` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `TargetType` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `TargetId` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `OldValue` text COLLATE utf8mb4_unicode_ci,
  `NewValue` text COLLATE utf8mb4_unicode_ci,
  `Note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `IpAddress` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`LogId`),
  KEY `admin_audit_logs__created_at` (`CreatedAt`),
  KEY `admin_audit_logs__admin_id__created_at` (`AdminId`,`CreatedAt`),
  KEY `admin_audit_logs__action__created_at` (`Action`,`CreatedAt`),
  KEY `admin_audit_logs__target_type__target_id` (`TargetType`,`TargetId`),
  CONSTRAINT `AdminAuditLogs_ibfk_1` FOREIGN KEY (`AdminId`) REFERENCES `Users` (`UserId`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `AdminAuditLogs` WRITE;
/*!40000 ALTER TABLE `AdminAuditLogs` DISABLE KEYS */;
INSERT INTO `AdminAuditLogs` VALUES (1,2,'CATEGORY_CREATE','CATEGORY','21',NULL,'{\"CategoryName\":\"danh M?C 000001\",\"Status\":\"ACTIVE\"}',NULL,'::ffff:172.18.0.1','2026-10-02 05:59:39'),(2,2,'CATEGORY_CREATE','CATEGORY','22',NULL,'{\"CategoryName\":\"B�n gh?\",\"Status\":\"ACTIVE\"}',NULL,'::ffff:172.18.0.1','2026-10-02 05:59:39'),(3,2,'CATEGORY_DELETE','CATEGORY','21','{\"CategoryName\":\"danh M?C 000001\",\"Description\":null,\"Status\":\"ACTIVE\"}',NULL,NULL,'::ffff:172.18.0.1','2026-10-02 05:59:51'),(4,2,'CATEGORY_DELETE','CATEGORY','22','{\"CategoryName\":\"B�n gh?\",\"Description\":null,\"Status\":\"ACTIVE\"}',NULL,NULL,'::ffff:172.18.0.1','2026-10-02 05:59:51'),(5,2,'CATEGORY_CREATE','CATEGORY','23',NULL,'{\"CategoryName\":\"Bàn ghế\",\"Status\":\"ACTIVE\"}',NULL,'::ffff:172.18.0.1','2026-10-02 05:59:52'),(6,2,'CATEGORY_CREATE','CATEGORY','24',NULL,'{\"CategoryName\":\"Bán ghế\",\"Status\":\"ACTIVE\"}',NULL,'::ffff:172.18.0.1','2026-10-02 05:59:52'),(7,2,'CATEGORY_DELETE','CATEGORY','23','{\"CategoryName\":\"Bàn ghế\",\"Description\":null,\"Status\":\"ACTIVE\"}',NULL,NULL,'::ffff:172.18.0.1','2026-10-02 05:59:52'),(8,2,'CATEGORY_DELETE','CATEGORY','24','{\"CategoryName\":\"Bán ghế\",\"Description\":null,\"Status\":\"ACTIVE\"}',NULL,NULL,'::ffff:172.18.0.1','2026-10-02 05:59:52'),(9,2,'CATEGORY_UPDATE','CATEGORY','1','{\"Status\":\"ACTIVE\"}','{\"Status\":\"INACTIVE\"}',NULL,'::ffff:172.18.0.1','2026-10-02 06:22:52'),(10,2,'CATEGORY_UPDATE','CATEGORY','1','{\"Status\":\"INACTIVE\"}','{\"Status\":\"ACTIVE\"}',NULL,'::ffff:172.18.0.1','2026-10-02 06:22:54'),(11,2,'LISTING_APPROVE','LISTING','3','{\"Status\":\"PENDING\"}','{\"Status\":\"ACTIVE\"}',NULL,'::ffff:172.18.0.1','2026-10-02 06:30:13'),(12,2,'REPORT_PROCESS','REPORT','20','{\"Status\":\"PENDING\"}','{\"Status\":\"PROCESSING\",\"actions\":[]}',NULL,'::ffff:172.18.0.1','2026-10-02 06:30:26'),(13,2,'REFUND_REVIEW','REFUND_REQUEST','20','{\"Status\":\"PENDING\",\"Amount\":70000}','{\"Status\":\"REVIEWING\",\"Amount\":70000,\"OrderId\":20}',NULL,'::ffff:172.18.0.1','2026-10-02 06:30:40'),(14,2,'FEE_CONFIRM','COMMISSION','17','{\"Status\":\"REPORTED\",\"AmountDue\":3350,\"PaymentProofUrl\":\"/demo/commission-proof/000017.jpg\"}','{\"Status\":\"PAID\",\"AmountDue\":3350,\"OrderId\":17,\"PaymentReference\":\"HH000017\"}',NULL,'::ffff:172.18.0.1','2026-10-02 06:31:01'),(15,2,'REFUND_REVIEW','REFUND_REQUEST','16','{\"Status\":\"PENDING\",\"Amount\":66000}','{\"Status\":\"REVIEWING\",\"Amount\":66000,\"OrderId\":16}',NULL,'::ffff:172.18.0.1','2026-10-02 06:31:52'),(16,2,'CATEGORY_CREATE','CATEGORY','25',NULL,'{\"CategoryName\":\"mới\",\"Description\":\"đồ hịadasd\",\"Status\":\"ACTIVE\"}',NULL,'::ffff:172.18.0.1','2026-10-02 06:45:34');
/*!40000 ALTER TABLE `AdminAuditLogs` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `Categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Categories` (
  `CategoryId` int unsigned NOT NULL AUTO_INCREMENT,
  `CategoryName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci NOT NULL,
  `Description` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`CategoryId`),
  UNIQUE KEY `CategoryName` (`CategoryName`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `Categories` WRITE;
/*!40000 ALTER TABLE `Categories` DISABLE KEYS */;
INSERT INTO `Categories` VALUES (1,'Danh mục 000001','Danh mục dữ liệu minh họa số 1','ACTIVE','2026-01-02 00:00:00'),(2,'Danh mục 000002','Danh mục dữ liệu minh họa số 2','ACTIVE','2026-01-03 00:00:00'),(3,'Danh mục 000003','Danh mục dữ liệu minh họa số 3','ACTIVE','2026-01-04 00:00:00'),(4,'Danh mục 000004','Danh mục dữ liệu minh họa số 4','ACTIVE','2026-01-05 00:00:00'),(5,'Danh mục 000005','Danh mục dữ liệu minh họa số 5','ACTIVE','2026-01-06 00:00:00'),(6,'Danh mục 000006','Danh mục dữ liệu minh họa số 6','ACTIVE','2026-01-07 00:00:00'),(7,'Danh mục 000007','Danh mục dữ liệu minh họa số 7','ACTIVE','2026-01-08 00:00:00'),(8,'Danh mục 000008','Danh mục dữ liệu minh họa số 8','ACTIVE','2026-01-09 00:00:00'),(9,'Danh mục 000009','Danh mục dữ liệu minh họa số 9','ACTIVE','2026-01-10 00:00:00'),(10,'Danh mục 000010','Danh mục dữ liệu minh họa số 10','ACTIVE','2026-01-11 00:00:00'),(11,'Danh mục 000011','Danh mục dữ liệu minh họa số 11','ACTIVE','2026-01-12 00:00:00'),(12,'Danh mục 000012','Danh mục dữ liệu minh họa số 12','ACTIVE','2026-01-13 00:00:00'),(13,'Danh mục 000013','Danh mục dữ liệu minh họa số 13','ACTIVE','2026-01-14 00:00:00'),(14,'Danh mục 000014','Danh mục dữ liệu minh họa số 14','ACTIVE','2026-01-15 00:00:00'),(15,'Danh mục 000015','Danh mục dữ liệu minh họa số 15','ACTIVE','2026-01-16 00:00:00'),(16,'Danh mục 000016','Danh mục dữ liệu minh họa số 16','ACTIVE','2026-01-17 00:00:00'),(17,'Danh mục 000017','Danh mục dữ liệu minh họa số 17','ACTIVE','2026-01-18 00:00:00'),(18,'Danh mục 000018','Danh mục dữ liệu minh họa số 18','ACTIVE','2026-01-19 00:00:00'),(19,'Danh mục 000019','Danh mục dữ liệu minh họa số 19','ACTIVE','2026-01-20 00:00:00'),(20,'Danh mục 000020','Danh mục dữ liệu minh họa số 20','ACTIVE','2026-01-21 00:00:00'),(25,'mới','đồ hịadasd','ACTIVE','2026-10-02 06:45:34');
/*!40000 ALTER TABLE `Categories` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `Commissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Commissions` (
  `CommissionId` int unsigned NOT NULL AUTO_INCREMENT,
  `OrderId` int unsigned NOT NULL,
  `SellerId` int unsigned NOT NULL,
  `Rate` decimal(5,2) NOT NULL,
  `OriginalAmount` decimal(18,2) NOT NULL,
  `AdjustmentAmount` decimal(18,2) NOT NULL DEFAULT '0.00',
  `AmountDue` decimal(18,2) NOT NULL,
  `PaymentReference` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `PaymentProofUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UNPAID',
  `DueAt` datetime DEFAULT NULL,
  `ConfirmedBy` int unsigned DEFAULT NULL,
  `ConfirmedAt` datetime DEFAULT NULL,
  `PaymentTransactionCode` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ReportedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`CommissionId`),
  UNIQUE KEY `OrderId` (`OrderId`),
  KEY `SellerId` (`SellerId`),
  KEY `ConfirmedBy` (`ConfirmedBy`),
  CONSTRAINT `Commissions_ibfk_1` FOREIGN KEY (`OrderId`) REFERENCES `Orders` (`OrderId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Commissions_ibfk_2` FOREIGN KEY (`SellerId`) REFERENCES `Users` (`UserId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Commissions_ibfk_3` FOREIGN KEY (`ConfirmedBy`) REFERENCES `Users` (`UserId`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `Commissions` WRITE;
/*!40000 ALTER TABLE `Commissions` DISABLE KEYS */;
INSERT INTO `Commissions` VALUES (1,1,1,5.00,2550.00,0.00,2550.00,'HH000001','/demo/commission-proof/000001.jpg','REPORTED','2026-01-12 00:00:00',NULL,NULL,NULL,NULL),(2,2,2,5.00,2600.00,0.00,2600.00,'HH000002','/demo/commission-proof/000002.jpg','PAID','2026-01-13 00:00:00',3,'2026-01-05 00:00:00',NULL,NULL),(3,3,3,5.00,2650.00,0.00,2650.00,'HH000003','/demo/commission-proof/000003.jpg','ADJUSTED','2026-01-14 00:00:00',4,'2026-01-06 00:00:00',NULL,NULL),(4,4,4,5.00,2700.00,0.00,2700.00,'HH000004','/demo/commission-proof/000004.jpg','UNPAID','2026-01-15 00:00:00',NULL,NULL,NULL,NULL),(5,5,5,5.00,2750.00,0.00,2750.00,'HH000005','/demo/commission-proof/000005.jpg','REPORTED','2026-01-16 00:00:00',NULL,NULL,NULL,NULL),(6,6,6,5.00,2800.00,0.00,2800.00,'HH000006','/demo/commission-proof/000006.jpg','PAID','2026-01-17 00:00:00',7,'2026-01-09 00:00:00',NULL,NULL),(7,7,7,5.00,2850.00,0.00,2850.00,'HH000007','/demo/commission-proof/000007.jpg','ADJUSTED','2026-01-18 00:00:00',8,'2026-01-10 00:00:00',NULL,NULL),(8,8,8,5.00,2900.00,0.00,2900.00,'HH000008','/demo/commission-proof/000008.jpg','UNPAID','2026-01-19 00:00:00',NULL,NULL,NULL,NULL),(9,9,9,5.00,2950.00,0.00,2950.00,'HH000009','/demo/commission-proof/000009.jpg','REPORTED','2026-01-20 00:00:00',NULL,NULL,NULL,NULL),(10,10,10,5.00,3000.00,0.00,3000.00,'HH000010','/demo/commission-proof/000010.jpg','PAID','2026-01-21 00:00:00',11,'2026-01-13 00:00:00',NULL,NULL),(11,11,11,5.00,3050.00,0.00,3050.00,'HH000011','/demo/commission-proof/000011.jpg','ADJUSTED','2026-01-22 00:00:00',12,'2026-01-14 00:00:00',NULL,NULL),(12,12,12,5.00,3100.00,0.00,3100.00,'HH000012','/demo/commission-proof/000012.jpg','UNPAID','2026-01-23 00:00:00',NULL,NULL,NULL,NULL),(13,13,13,5.00,3150.00,0.00,3150.00,'HH000013','/demo/commission-proof/000013.jpg','REPORTED','2026-01-24 00:00:00',NULL,NULL,NULL,NULL),(14,14,14,5.00,3200.00,0.00,3200.00,'HH000014','/demo/commission-proof/000014.jpg','PAID','2026-01-25 00:00:00',15,'2026-01-17 00:00:00',NULL,NULL),(15,15,15,5.00,3250.00,0.00,3250.00,'HH000015','/demo/commission-proof/000015.jpg','ADJUSTED','2026-01-26 00:00:00',16,'2026-01-18 00:00:00',NULL,NULL),(16,16,16,5.00,3300.00,0.00,3300.00,'HH000016','/demo/commission-proof/000016.jpg','UNPAID','2026-01-27 00:00:00',NULL,NULL,NULL,NULL),(17,17,17,5.00,3350.00,0.00,3350.00,'HH000017','/demo/commission-proof/000017.jpg','PAID','2026-01-28 00:00:00',2,'2026-10-02 06:31:01',NULL,NULL),(18,18,18,5.00,3400.00,0.00,3400.00,'HH000018','/demo/commission-proof/000018.jpg','PAID','2026-01-29 00:00:00',19,'2026-01-21 00:00:00',NULL,NULL),(19,19,19,5.00,3450.00,0.00,3450.00,'HH000019','/demo/commission-proof/000019.jpg','ADJUSTED','2026-01-30 00:00:00',20,'2026-01-22 00:00:00',NULL,NULL),(20,20,20,5.00,3500.00,-5000.00,0.00,'HH000020','/demo/commission-proof/000020.jpg','UNPAID','2026-01-31 00:00:00',NULL,NULL,NULL,NULL),(25,9001,3,5.00,125000.00,0.00,125000.00,'HH009001',NULL,'UNPAID','2026-10-09 06:54:38',NULL,NULL,NULL,NULL),(26,9002,3,5.00,60000.00,0.00,60000.00,'HH009002',NULL,'UNPAID','2026-10-09 06:54:38',NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `Commissions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `ConditionOptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ConditionOptions` (
  `ConditionCode` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Label` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci NOT NULL,
  `Description` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `SortOrder` int unsigned NOT NULL DEFAULT '0',
  `Status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ConditionCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `ConditionOptions` WRITE;
/*!40000 ALTER TABLE `ConditionOptions` DISABLE KEYS */;
INSERT INTO `ConditionOptions` VALUES ('FAIR','Đã qua sử dụng - khá','Trầy xước hoặc hao mòn thấy rõ, vẫn dùng được.',4,'ACTIVE','2026-10-02 05:59:38'),('GOOD','Đã qua sử dụng - tốt','Có dấu hiệu sử dụng nhẹ, hoạt động bình thường.',3,'ACTIVE','2026-10-02 05:59:38'),('LIKE_NEW','Như mới','Gần như chưa sử dụng, không trầy xước.',2,'ACTIVE','2026-10-02 05:59:38'),('NEW','Mới','Chưa qua sử dụng, còn nguyên hộp hoặc tem.',1,'ACTIVE','2026-10-02 05:59:38'),('POOR','Cũ nhiều','Hư hỏng một phần, cần sửa chữa hoặc lấy linh kiện.',5,'ACTIVE','2026-10-02 05:59:38');
/*!40000 ALTER TABLE `ConditionOptions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `Conversations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Conversations` (
  `ConversationId` int unsigned NOT NULL AUTO_INCREMENT,
  `ListingId` int unsigned DEFAULT NULL,
  `OrderId` int unsigned DEFAULT NULL,
  `CreatedBy` int unsigned NOT NULL,
  `ConversationType` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `LastMessageAt` datetime DEFAULT NULL,
  PRIMARY KEY (`ConversationId`),
  KEY `ListingId` (`ListingId`),
  KEY `OrderId` (`OrderId`),
  KEY `CreatedBy` (`CreatedBy`),
  CONSTRAINT `Conversations_ibfk_1` FOREIGN KEY (`ListingId`) REFERENCES `Listings` (`ListingId`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Conversations_ibfk_2` FOREIGN KEY (`OrderId`) REFERENCES `Orders` (`OrderId`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Conversations_ibfk_3` FOREIGN KEY (`CreatedBy`) REFERENCES `Users` (`UserId`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `Conversations` WRITE;
/*!40000 ALTER TABLE `Conversations` DISABLE KEYS */;
INSERT INTO `Conversations` VALUES (1,1,1,2,'DIRECT_CHAT','2026-01-02 00:00:00','2026-01-03 00:00:00'),(2,2,2,3,'DIRECT_CHAT','2026-01-03 00:00:00','2026-01-04 00:00:00'),(3,3,3,4,'DIRECT_CHAT','2026-01-04 00:00:00','2026-01-05 00:00:00'),(4,4,4,5,'DIRECT_CHAT','2026-01-05 00:00:00','2026-01-06 00:00:00'),(5,5,5,6,'AI_SUPPORT','2026-01-06 00:00:00','2026-01-07 00:00:00'),(6,6,6,7,'DIRECT_CHAT','2026-01-07 00:00:00','2026-01-08 00:00:00'),(7,7,7,8,'DIRECT_CHAT','2026-01-08 00:00:00','2026-01-09 00:00:00'),(8,8,8,9,'DIRECT_CHAT','2026-01-09 00:00:00','2026-01-10 00:00:00'),(9,9,9,10,'DIRECT_CHAT','2026-01-10 00:00:00','2026-01-11 00:00:00'),(10,10,10,11,'AI_SUPPORT','2026-01-11 00:00:00','2026-01-12 00:00:00'),(11,11,11,12,'DIRECT_CHAT','2026-01-12 00:00:00','2026-01-13 00:00:00'),(12,12,12,13,'DIRECT_CHAT','2026-01-13 00:00:00','2026-01-14 00:00:00'),(13,13,13,14,'DIRECT_CHAT','2026-01-14 00:00:00','2026-01-15 00:00:00'),(14,14,14,15,'DIRECT_CHAT','2026-01-15 00:00:00','2026-01-16 00:00:00'),(15,15,15,16,'AI_SUPPORT','2026-01-16 00:00:00','2026-01-17 00:00:00'),(16,16,16,17,'DIRECT_CHAT','2026-01-17 00:00:00','2026-01-18 00:00:00'),(17,17,17,18,'DIRECT_CHAT','2026-01-18 00:00:00','2026-01-19 00:00:00'),(18,18,18,19,'DIRECT_CHAT','2026-01-19 00:00:00','2026-01-20 00:00:00'),(19,19,19,20,'DIRECT_CHAT','2026-01-20 00:00:00','2026-01-21 00:00:00'),(20,20,20,1,'AI_SUPPORT','2026-01-21 00:00:00','2026-01-22 00:00:00');
/*!40000 ALTER TABLE `Conversations` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `Deliveries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Deliveries` (
  `DeliveryId` int unsigned NOT NULL AUTO_INCREMENT,
  `OrderId` int unsigned NOT NULL,
  `DriverId` int unsigned DEFAULT NULL,
  `PickupAddress` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `DeliveryAddress` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `DriverFee` decimal(18,2) NOT NULL DEFAULT '0.00',
  `PickupCodeHash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'AVAILABLE',
  `RetryCount` tinyint unsigned NOT NULL DEFAULT '0',
  `FailureReason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ProofUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `AcceptedAt` datetime DEFAULT NULL,
  `PickedUpAt` datetime DEFAULT NULL,
  `DeliveredAt` datetime DEFAULT NULL,
  `ReturnedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`DeliveryId`),
  UNIQUE KEY `OrderId` (`OrderId`),
  KEY `deliveries__driver_id__status` (`DriverId`,`Status`),
  CONSTRAINT `Deliveries_ibfk_1` FOREIGN KEY (`OrderId`) REFERENCES `Orders` (`OrderId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Deliveries_ibfk_2` FOREIGN KEY (`DriverId`) REFERENCES `Users` (`UserId`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `Deliveries` WRITE;
/*!40000 ALTER TABLE `Deliveries` DISABLE KEYS */;
INSERT INTO `Deliveries` VALUES (1,1,2,'1 Đường Lấy Hàng, TP. Hồ Chí Minh','1 Đường Giao Hàng, TP. Hồ Chí Minh',30000.00,'hashed_pickup_000001','ACCEPTED',1,NULL,'/demo/delivery-proof/000001.jpg','2026-01-02 00:00:00',NULL,NULL,NULL),(2,2,3,'2 Đường Lấy Hàng, TP. Hồ Chí Minh','2 Đường Giao Hàng, TP. Hồ Chí Minh',30000.00,'hashed_pickup_000002','PICKED_UP',2,NULL,'/demo/delivery-proof/000002.jpg','2026-01-03 00:00:00','2026-01-04 00:00:00',NULL,NULL),(3,3,4,'3 Đường Lấy Hàng, TP. Hồ Chí Minh','3 Đường Giao Hàng, TP. Hồ Chí Minh',30000.00,'hashed_pickup_000003','DELIVERED',0,NULL,'/demo/delivery-proof/000003.jpg','2026-01-04 00:00:00','2026-01-05 00:00:00','2026-01-06 00:00:00',NULL),(4,4,5,'4 Đường Lấy Hàng, TP. Hồ Chí Minh','4 Đường Giao Hàng, TP. Hồ Chí Minh',30000.00,'hashed_pickup_000004','FAILED',1,'Không liên hệ được người nhận.','/demo/delivery-proof/000004.jpg','2026-01-05 00:00:00','2026-01-06 00:00:00',NULL,'2026-01-08 00:00:00'),(5,5,6,'5 Đường Lấy Hàng, TP. Hồ Chí Minh','5 Đường Giao Hàng, TP. Hồ Chí Minh',30000.00,'hashed_pickup_000005','AVAILABLE',2,NULL,'/demo/delivery-proof/000005.jpg',NULL,NULL,NULL,NULL),(6,6,7,'6 Đường Lấy Hàng, TP. Hồ Chí Minh','6 Đường Giao Hàng, TP. Hồ Chí Minh',30000.00,'hashed_pickup_000006','ACCEPTED',0,NULL,'/demo/delivery-proof/000006.jpg','2026-01-07 00:00:00',NULL,NULL,NULL),(7,7,8,'7 Đường Lấy Hàng, TP. Hồ Chí Minh','7 Đường Giao Hàng, TP. Hồ Chí Minh',30000.00,'hashed_pickup_000007','PICKED_UP',1,NULL,'/demo/delivery-proof/000007.jpg','2026-01-08 00:00:00','2026-01-09 00:00:00',NULL,NULL),(8,8,9,'8 Đường Lấy Hàng, TP. Hồ Chí Minh','8 Đường Giao Hàng, TP. Hồ Chí Minh',30000.00,'hashed_pickup_000008','DELIVERED',2,NULL,'/demo/delivery-proof/000008.jpg','2026-01-09 00:00:00','2026-01-10 00:00:00','2026-01-11 00:00:00',NULL),(9,9,10,'9 Đường Lấy Hàng, TP. Hồ Chí Minh','9 Đường Giao Hàng, TP. Hồ Chí Minh',30000.00,'hashed_pickup_000009','FAILED',0,'Không liên hệ được người nhận.','/demo/delivery-proof/000009.jpg','2026-01-10 00:00:00','2026-01-11 00:00:00',NULL,'2026-01-13 00:00:00'),(10,10,11,'10 Đường Lấy Hàng, TP. Hồ Chí Minh','10 Đường Giao Hàng, TP. Hồ Chí Minh',30000.00,'hashed_pickup_000010','AVAILABLE',1,NULL,'/demo/delivery-proof/000010.jpg',NULL,NULL,NULL,NULL),(11,11,12,'11 Đường Lấy Hàng, TP. Hồ Chí Minh','11 Đường Giao Hàng, TP. Hồ Chí Minh',30000.00,'hashed_pickup_000011','ACCEPTED',2,NULL,'/demo/delivery-proof/000011.jpg','2026-01-12 00:00:00',NULL,NULL,NULL),(12,12,13,'12 Đường Lấy Hàng, TP. Hồ Chí Minh','12 Đường Giao Hàng, TP. Hồ Chí Minh',30000.00,'hashed_pickup_000012','PICKED_UP',0,NULL,'/demo/delivery-proof/000012.jpg','2026-01-13 00:00:00','2026-01-14 00:00:00',NULL,NULL),(13,13,14,'13 Đường Lấy Hàng, TP. Hồ Chí Minh','13 Đường Giao Hàng, TP. Hồ Chí Minh',30000.00,'hashed_pickup_000013','DELIVERED',1,NULL,'/demo/delivery-proof/000013.jpg','2026-01-14 00:00:00','2026-01-15 00:00:00','2026-01-16 00:00:00',NULL),(14,14,15,'14 Đường Lấy Hàng, TP. Hồ Chí Minh','14 Đường Giao Hàng, TP. Hồ Chí Minh',30000.00,'hashed_pickup_000014','FAILED',2,'Không liên hệ được người nhận.','/demo/delivery-proof/000014.jpg','2026-01-15 00:00:00','2026-01-16 00:00:00',NULL,'2026-01-18 00:00:00'),(15,15,16,'15 Đường Lấy Hàng, TP. Hồ Chí Minh','15 Đường Giao Hàng, TP. Hồ Chí Minh',30000.00,'hashed_pickup_000015','AVAILABLE',0,NULL,'/demo/delivery-proof/000015.jpg',NULL,NULL,NULL,NULL),(16,16,17,'16 Đường Lấy Hàng, TP. Hồ Chí Minh','16 Đường Giao Hàng, TP. Hồ Chí Minh',30000.00,'hashed_pickup_000016','ACCEPTED',1,NULL,'/demo/delivery-proof/000016.jpg','2026-01-17 00:00:00',NULL,NULL,NULL),(17,17,18,'17 Đường Lấy Hàng, TP. Hồ Chí Minh','17 Đường Giao Hàng, TP. Hồ Chí Minh',30000.00,'hashed_pickup_000017','PICKED_UP',2,NULL,'/demo/delivery-proof/000017.jpg','2026-01-18 00:00:00','2026-01-19 00:00:00',NULL,NULL),(18,18,19,'18 Đường Lấy Hàng, TP. Hồ Chí Minh','18 Đường Giao Hàng, TP. Hồ Chí Minh',30000.00,'hashed_pickup_000018','DELIVERED',0,NULL,'/demo/delivery-proof/000018.jpg','2026-01-19 00:00:00','2026-01-20 00:00:00','2026-01-21 00:00:00',NULL),(19,19,20,'19 Đường Lấy Hàng, TP. Hồ Chí Minh','19 Đường Giao Hàng, TP. Hồ Chí Minh',30000.00,'hashed_pickup_000019','FAILED',1,'Không liên hệ được người nhận.','/demo/delivery-proof/000019.jpg','2026-01-20 00:00:00','2026-01-21 00:00:00',NULL,'2026-01-23 00:00:00'),(20,20,1,'20 Đường Lấy Hàng, TP. Hồ Chí Minh','20 Đường Giao Hàng, TP. Hồ Chí Minh',30000.00,'hashed_pickup_000020','AVAILABLE',2,NULL,'/demo/delivery-proof/000020.jpg',NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `Deliveries` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `Favorites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Favorites` (
  `UserId` int unsigned NOT NULL,
  `ListingId` int unsigned NOT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`UserId`,`ListingId`),
  KEY `ListingId` (`ListingId`),
  CONSTRAINT `Favorites_ibfk_1` FOREIGN KEY (`UserId`) REFERENCES `Users` (`UserId`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Favorites_ibfk_2` FOREIGN KEY (`ListingId`) REFERENCES `Listings` (`ListingId`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `Favorites` WRITE;
/*!40000 ALTER TABLE `Favorites` DISABLE KEYS */;
INSERT INTO `Favorites` VALUES (1,1,'2026-01-02 00:00:00'),(2,2,'2026-01-03 00:00:00'),(3,3,'2026-01-04 00:00:00'),(4,4,'2026-01-05 00:00:00'),(5,5,'2026-01-06 00:00:00'),(6,6,'2026-01-07 00:00:00'),(7,7,'2026-01-08 00:00:00'),(8,8,'2026-01-09 00:00:00'),(9,9,'2026-01-10 00:00:00'),(10,10,'2026-01-11 00:00:00'),(11,11,'2026-01-12 00:00:00'),(12,12,'2026-01-13 00:00:00'),(13,13,'2026-01-14 00:00:00'),(14,14,'2026-01-15 00:00:00'),(15,15,'2026-01-16 00:00:00'),(16,16,'2026-01-17 00:00:00'),(17,17,'2026-01-18 00:00:00'),(18,18,'2026-01-19 00:00:00'),(19,19,'2026-01-20 00:00:00'),(20,20,'2026-01-21 00:00:00');
/*!40000 ALTER TABLE `Favorites` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `ListingMedia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ListingMedia` (
  `MediaId` int unsigned NOT NULL AUTO_INCREMENT,
  `ListingId` int unsigned NOT NULL,
  `MediaType` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'IMAGE',
  `MediaUrl` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `SortOrder` tinyint unsigned NOT NULL DEFAULT '1',
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`MediaId`),
  KEY `ListingId` (`ListingId`),
  CONSTRAINT `ListingMedia_ibfk_1` FOREIGN KEY (`ListingId`) REFERENCES `Listings` (`ListingId`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `ListingMedia` WRITE;
/*!40000 ALTER TABLE `ListingMedia` DISABLE KEYS */;
INSERT INTO `ListingMedia` VALUES (1,1,'IMAGE','/demo/listings/000001.jpg',1,'2026-01-02 00:00:00'),(2,2,'IMAGE','/demo/listings/000002.jpg',1,'2026-01-03 00:00:00'),(3,3,'IMAGE','/demo/listings/000003.jpg',1,'2026-01-04 00:00:00'),(4,4,'IMAGE','/demo/listings/000004.jpg',1,'2026-01-05 00:00:00'),(5,5,'IMAGE','/demo/listings/000005.jpg',1,'2026-01-06 00:00:00'),(6,6,'IMAGE','/demo/listings/000006.jpg',1,'2026-01-07 00:00:00'),(7,7,'IMAGE','/demo/listings/000007.jpg',1,'2026-01-08 00:00:00'),(8,8,'IMAGE','/demo/listings/000008.jpg',1,'2026-01-09 00:00:00'),(9,9,'IMAGE','/demo/listings/000009.jpg',1,'2026-01-10 00:00:00'),(10,10,'VIDEO','/demo/listings/000010.mp4',1,'2026-01-11 00:00:00'),(11,11,'IMAGE','/demo/listings/000011.jpg',1,'2026-01-12 00:00:00'),(12,12,'IMAGE','/demo/listings/000012.jpg',1,'2026-01-13 00:00:00'),(13,13,'IMAGE','/demo/listings/000013.jpg',1,'2026-01-14 00:00:00'),(14,14,'IMAGE','/demo/listings/000014.jpg',1,'2026-01-15 00:00:00'),(15,15,'IMAGE','/demo/listings/000015.jpg',1,'2026-01-16 00:00:00'),(16,16,'IMAGE','/demo/listings/000016.jpg',1,'2026-01-17 00:00:00'),(17,17,'IMAGE','/demo/listings/000017.jpg',1,'2026-01-18 00:00:00'),(18,18,'IMAGE','/demo/listings/000018.jpg',1,'2026-01-19 00:00:00'),(19,19,'IMAGE','/demo/listings/000019.jpg',1,'2026-01-20 00:00:00'),(20,20,'VIDEO','/demo/listings/000020.mp4',1,'2026-01-21 00:00:00');
/*!40000 ALTER TABLE `ListingMedia` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `ListingPromotions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ListingPromotions` (
  `PromotionId` int unsigned NOT NULL AUTO_INCREMENT,
  `ListingId` int unsigned NOT NULL,
  `SellerId` int unsigned NOT NULL,
  `PlanName` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `FeeAmount` decimal(18,2) NOT NULL,
  `PaymentReference` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `PaymentProofUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `StartsAt` datetime DEFAULT NULL,
  `EndsAt` datetime DEFAULT NULL,
  `ConfirmedBy` int unsigned DEFAULT NULL,
  `ConfirmedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`PromotionId`),
  KEY `ListingId` (`ListingId`),
  KEY `SellerId` (`SellerId`),
  KEY `ConfirmedBy` (`ConfirmedBy`),
  CONSTRAINT `ListingPromotions_ibfk_1` FOREIGN KEY (`ListingId`) REFERENCES `Listings` (`ListingId`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ListingPromotions_ibfk_2` FOREIGN KEY (`SellerId`) REFERENCES `Users` (`UserId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ListingPromotions_ibfk_3` FOREIGN KEY (`ConfirmedBy`) REFERENCES `Users` (`UserId`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `ListingPromotions` WRITE;
/*!40000 ALTER TABLE `ListingPromotions` DISABLE KEYS */;
INSERT INTO `ListingPromotions` VALUES (1,1,1,'VIP_7_DAYS',40000.00,'VIP000001','/demo/vip-proof/000001.jpg','ACTIVE','2026-01-02 00:00:00','2026-01-09 00:00:00',2,'2026-01-02 00:00:00'),(2,2,2,'VIP_14_DAYS',70000.00,'VIP000002','/demo/vip-proof/000002.jpg','EXPIRED','2026-01-03 00:00:00','2026-01-10 00:00:00',3,'2026-01-03 00:00:00'),(3,3,3,'VIP_3_DAYS',20000.00,'VIP000003','/demo/vip-proof/000003.jpg','PENDING','2026-01-04 00:00:00','2026-01-11 00:00:00',NULL,NULL),(4,4,4,'VIP_7_DAYS',40000.00,'VIP000004','/demo/vip-proof/000004.jpg','ACTIVE','2026-01-05 00:00:00','2026-01-12 00:00:00',5,'2026-01-05 00:00:00'),(5,5,5,'VIP_14_DAYS',70000.00,'VIP000005','/demo/vip-proof/000005.jpg','EXPIRED','2026-01-06 00:00:00','2026-01-13 00:00:00',6,'2026-01-06 00:00:00'),(6,6,6,'VIP_3_DAYS',20000.00,'VIP000006','/demo/vip-proof/000006.jpg','PENDING','2026-01-07 00:00:00','2026-01-14 00:00:00',NULL,NULL),(7,7,7,'VIP_7_DAYS',40000.00,'VIP000007','/demo/vip-proof/000007.jpg','ACTIVE','2026-01-08 00:00:00','2026-01-15 00:00:00',8,'2026-01-08 00:00:00'),(8,8,8,'VIP_14_DAYS',70000.00,'VIP000008','/demo/vip-proof/000008.jpg','EXPIRED','2026-01-09 00:00:00','2026-01-16 00:00:00',9,'2026-01-09 00:00:00'),(9,9,9,'VIP_3_DAYS',20000.00,'VIP000009','/demo/vip-proof/000009.jpg','PENDING','2026-01-10 00:00:00','2026-01-17 00:00:00',NULL,NULL),(10,10,10,'VIP_7_DAYS',40000.00,'VIP000010','/demo/vip-proof/000010.jpg','ACTIVE','2026-01-11 00:00:00','2026-01-18 00:00:00',11,'2026-01-11 00:00:00'),(11,11,11,'VIP_14_DAYS',70000.00,'VIP000011','/demo/vip-proof/000011.jpg','EXPIRED','2026-01-12 00:00:00','2026-01-19 00:00:00',12,'2026-01-12 00:00:00'),(12,12,12,'VIP_3_DAYS',20000.00,'VIP000012','/demo/vip-proof/000012.jpg','PENDING','2026-01-13 00:00:00','2026-01-20 00:00:00',NULL,NULL),(13,13,13,'VIP_7_DAYS',40000.00,'VIP000013','/demo/vip-proof/000013.jpg','ACTIVE','2026-01-14 00:00:00','2026-01-21 00:00:00',14,'2026-01-14 00:00:00'),(14,14,14,'VIP_14_DAYS',70000.00,'VIP000014','/demo/vip-proof/000014.jpg','EXPIRED','2026-01-15 00:00:00','2026-01-22 00:00:00',15,'2026-01-15 00:00:00'),(15,15,15,'VIP_3_DAYS',20000.00,'VIP000015','/demo/vip-proof/000015.jpg','PENDING','2026-01-16 00:00:00','2026-01-23 00:00:00',NULL,NULL),(16,16,16,'VIP_7_DAYS',40000.00,'VIP000016','/demo/vip-proof/000016.jpg','ACTIVE','2026-01-17 00:00:00','2026-01-24 00:00:00',17,'2026-01-17 00:00:00'),(17,17,17,'VIP_14_DAYS',70000.00,'VIP000017','/demo/vip-proof/000017.jpg','EXPIRED','2026-01-18 00:00:00','2026-01-25 00:00:00',18,'2026-01-18 00:00:00'),(18,18,18,'VIP_3_DAYS',20000.00,'VIP000018','/demo/vip-proof/000018.jpg','PENDING','2026-01-19 00:00:00','2026-01-26 00:00:00',NULL,NULL),(19,19,19,'VIP_7_DAYS',40000.00,'VIP000019','/demo/vip-proof/000019.jpg','ACTIVE','2026-01-20 00:00:00','2026-01-27 00:00:00',20,'2026-01-20 00:00:00'),(20,20,20,'VIP_14_DAYS',70000.00,'VIP000020','/demo/vip-proof/000020.jpg','EXPIRED','2026-01-21 00:00:00','2026-01-28 00:00:00',1,'2026-01-21 00:00:00');
/*!40000 ALTER TABLE `ListingPromotions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `Listings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Listings` (
  `ListingId` int unsigned NOT NULL AUTO_INCREMENT,
  `SellerId` int unsigned NOT NULL,
  `StoreId` int unsigned DEFAULT NULL,
  `CategoryId` int unsigned NOT NULL,
  `Title` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `Price` decimal(18,2) NOT NULL,
  `ConditionLevel` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `KnownDefects` text COLLATE utf8mb4_unicode_ci,
  `Location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `ModerationNote` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`ListingId`),
  KEY `StoreId` (`StoreId`),
  KEY `listings__category_id__status__price` (`CategoryId`,`Status`,`Price`),
  KEY `listings__seller_id__status` (`SellerId`,`Status`),
  CONSTRAINT `Listings_ibfk_1` FOREIGN KEY (`SellerId`) REFERENCES `Users` (`UserId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Listings_ibfk_2` FOREIGN KEY (`StoreId`) REFERENCES `Stores` (`StoreId`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Listings_ibfk_3` FOREIGN KEY (`CategoryId`) REFERENCES `Categories` (`CategoryId`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `Listings` WRITE;
/*!40000 ALTER TABLE `Listings` DISABLE KEYS */;
INSERT INTO `Listings` VALUES (1,1,1,1,'Sản phẩm cũ minh họa 000001','Mô tả sản phẩm cũ số 1, dùng cho dữ liệu kiểm thử.',51000.00,'GOOD',NULL,'Khu vực 1, TP. Hồ Chí Minh','RESERVED',NULL,'2026-01-02 00:00:00','2026-01-03 00:00:00'),(2,2,2,2,'Sản phẩm cũ minh họa 000002','Mô tả sản phẩm cũ số 2, dùng cho dữ liệu kiểm thử.',52000.00,'FAIR',NULL,'Khu vực 2, TP. Hồ Chí Minh','SOLD',NULL,'2026-01-03 00:00:00','2026-01-04 00:00:00'),(3,3,3,3,'Sản phẩm cũ minh họa 000003','Mô tả sản phẩm cũ số 3, dùng cho dữ liệu kiểm thử.',53000.00,'POOR',NULL,'Khu vực 3, TP. Hồ Chí Minh','ACTIVE',NULL,'2026-01-04 00:00:00','2026-10-02 06:30:13'),(4,4,4,4,'Sản phẩm cũ minh họa 000004','Mô tả sản phẩm cũ số 4, dùng cho dữ liệu kiểm thử.',54000.00,'LIKE_NEW',NULL,'Khu vực 4, TP. Hồ Chí Minh','ACTIVE',NULL,'2026-01-05 00:00:00','2026-01-06 00:00:00'),(5,5,5,5,'Sản phẩm cũ minh họa 000005','Mô tả sản phẩm cũ số 5, dùng cho dữ liệu kiểm thử.',55000.00,'GOOD','Có dấu hiệu sử dụng nhẹ.','Khu vực 5, TP. Hồ Chí Minh','RESERVED',NULL,'2026-01-06 00:00:00','2026-01-07 00:00:00'),(6,6,6,6,'Sản phẩm cũ minh họa 000006','Mô tả sản phẩm cũ số 6, dùng cho dữ liệu kiểm thử.',56000.00,'FAIR',NULL,'Khu vực 6, TP. Hồ Chí Minh','SOLD',NULL,'2026-01-07 00:00:00','2026-01-08 00:00:00'),(7,7,7,7,'Sản phẩm cũ minh họa 000007','Mô tả sản phẩm cũ số 7, dùng cho dữ liệu kiểm thử.',57000.00,'POOR',NULL,'Khu vực 7, TP. Hồ Chí Minh','PENDING',NULL,'2026-01-08 00:00:00','2026-01-09 00:00:00'),(8,8,8,8,'Sản phẩm cũ minh họa 000008','Mô tả sản phẩm cũ số 8, dùng cho dữ liệu kiểm thử.',58000.00,'LIKE_NEW',NULL,'Khu vực 8, TP. Hồ Chí Minh','ACTIVE',NULL,'2026-01-09 00:00:00','2026-01-10 00:00:00'),(9,9,9,9,'Sản phẩm cũ minh họa 000009','Mô tả sản phẩm cũ số 9, dùng cho dữ liệu kiểm thử.',59000.00,'GOOD',NULL,'Khu vực 9, TP. Hồ Chí Minh','RESERVED',NULL,'2026-01-10 00:00:00','2026-01-11 00:00:00'),(10,10,10,10,'Sản phẩm cũ minh họa 000010','Mô tả sản phẩm cũ số 10, dùng cho dữ liệu kiểm thử.',60000.00,'FAIR','Có dấu hiệu sử dụng nhẹ.','Khu vực 10, TP. Hồ Chí Minh','SOLD',NULL,'2026-01-11 00:00:00','2026-01-12 00:00:00'),(11,11,11,11,'Sản phẩm cũ minh họa 000011','Mô tả sản phẩm cũ số 11, dùng cho dữ liệu kiểm thử.',61000.00,'POOR',NULL,'Khu vực 11, TP. Hồ Chí Minh','PENDING',NULL,'2026-01-12 00:00:00','2026-01-13 00:00:00'),(12,12,12,12,'Sản phẩm cũ minh họa 000012','Mô tả sản phẩm cũ số 12, dùng cho dữ liệu kiểm thử.',62000.00,'LIKE_NEW',NULL,'Khu vực 12, TP. Hồ Chí Minh','ACTIVE',NULL,'2026-01-13 00:00:00','2026-01-14 00:00:00'),(13,13,13,13,'Sản phẩm cũ minh họa 000013','Mô tả sản phẩm cũ số 13, dùng cho dữ liệu kiểm thử.',63000.00,'GOOD',NULL,'Khu vực 13, TP. Hồ Chí Minh','RESERVED',NULL,'2026-01-14 00:00:00','2026-01-15 00:00:00'),(14,14,14,14,'Sản phẩm cũ minh họa 000014','Mô tả sản phẩm cũ số 14, dùng cho dữ liệu kiểm thử.',64000.00,'FAIR',NULL,'Khu vực 14, TP. Hồ Chí Minh','SOLD',NULL,'2026-01-15 00:00:00','2026-01-16 00:00:00'),(15,15,15,15,'Sản phẩm cũ minh họa 000015','Mô tả sản phẩm cũ số 15, dùng cho dữ liệu kiểm thử.',65000.00,'POOR','Có dấu hiệu sử dụng nhẹ.','Khu vực 15, TP. Hồ Chí Minh','PENDING',NULL,'2026-01-16 00:00:00','2026-01-17 00:00:00'),(16,16,16,16,'Sản phẩm cũ minh họa 000016','Mô tả sản phẩm cũ số 16, dùng cho dữ liệu kiểm thử.',66000.00,'LIKE_NEW',NULL,'Khu vực 16, TP. Hồ Chí Minh','ACTIVE',NULL,'2026-01-17 00:00:00','2026-01-18 00:00:00'),(17,17,17,17,'Sản phẩm cũ minh họa 000017','Mô tả sản phẩm cũ số 17, dùng cho dữ liệu kiểm thử.',67000.00,'GOOD',NULL,'Khu vực 17, TP. Hồ Chí Minh','RESERVED',NULL,'2026-01-18 00:00:00','2026-01-19 00:00:00'),(18,18,18,18,'Sản phẩm cũ minh họa 000018','Mô tả sản phẩm cũ số 18, dùng cho dữ liệu kiểm thử.',68000.00,'FAIR',NULL,'Khu vực 18, TP. Hồ Chí Minh','SOLD',NULL,'2026-01-19 00:00:00','2026-01-20 00:00:00'),(19,19,19,19,'Sản phẩm cũ minh họa 000019','Mô tả sản phẩm cũ số 19, dùng cho dữ liệu kiểm thử.',69000.00,'POOR',NULL,'Khu vực 19, TP. Hồ Chí Minh','PENDING',NULL,'2026-01-20 00:00:00','2026-01-21 00:00:00'),(20,20,20,20,'Sản phẩm cũ minh họa 000020','Mô tả sản phẩm cũ số 20, dùng cho dữ liệu kiểm thử.',70000.00,'LIKE_NEW','Có dấu hiệu sử dụng nhẹ.','Khu vực 20, TP. Hồ Chí Minh','ACTIVE',NULL,'2026-01-21 00:00:00','2026-01-22 00:00:00');
/*!40000 ALTER TABLE `Listings` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `Messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Messages` (
  `MessageId` int unsigned NOT NULL AUTO_INCREMENT,
  `ConversationId` int unsigned NOT NULL,
  `SenderId` int unsigned DEFAULT NULL,
  `SenderType` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `IsRead` tinyint(1) NOT NULL DEFAULT '0',
  `SentAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`MessageId`),
  KEY `SenderId` (`SenderId`),
  KEY `messages__conversation_id__sent_at` (`ConversationId`,`SentAt`),
  CONSTRAINT `Messages_ibfk_1` FOREIGN KEY (`ConversationId`) REFERENCES `Conversations` (`ConversationId`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Messages_ibfk_2` FOREIGN KEY (`SenderId`) REFERENCES `Users` (`UserId`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `Messages` WRITE;
/*!40000 ALTER TABLE `Messages` DISABLE KEYS */;
INSERT INTO `Messages` VALUES (1,1,2,'USER','Tin nhắn dữ liệu mẫu số 1',0,'2026-01-02 00:00:00'),(2,2,3,'USER','Tin nhắn dữ liệu mẫu số 2',1,'2026-01-03 00:00:00'),(3,3,4,'USER','Tin nhắn dữ liệu mẫu số 3',0,'2026-01-04 00:00:00'),(4,4,5,'USER','Tin nhắn dữ liệu mẫu số 4',1,'2026-01-05 00:00:00'),(5,5,NULL,'AI','Tin nhắn dữ liệu mẫu số 5',0,'2026-01-06 00:00:00'),(6,6,7,'USER','Tin nhắn dữ liệu mẫu số 6',1,'2026-01-07 00:00:00'),(7,7,8,'USER','Tin nhắn dữ liệu mẫu số 7',0,'2026-01-08 00:00:00'),(8,8,9,'USER','Tin nhắn dữ liệu mẫu số 8',1,'2026-01-09 00:00:00'),(9,9,10,'USER','Tin nhắn dữ liệu mẫu số 9',0,'2026-01-10 00:00:00'),(10,10,NULL,'AI','Tin nhắn dữ liệu mẫu số 10',1,'2026-01-11 00:00:00'),(11,11,12,'USER','Tin nhắn dữ liệu mẫu số 11',0,'2026-01-12 00:00:00'),(12,12,13,'USER','Tin nhắn dữ liệu mẫu số 12',1,'2026-01-13 00:00:00'),(13,13,14,'USER','Tin nhắn dữ liệu mẫu số 13',0,'2026-01-14 00:00:00'),(14,14,15,'USER','Tin nhắn dữ liệu mẫu số 14',1,'2026-01-15 00:00:00'),(15,15,NULL,'AI','Tin nhắn dữ liệu mẫu số 15',0,'2026-01-16 00:00:00'),(16,16,17,'USER','Tin nhắn dữ liệu mẫu số 16',1,'2026-01-17 00:00:00'),(17,17,18,'USER','Tin nhắn dữ liệu mẫu số 17',0,'2026-01-18 00:00:00'),(18,18,19,'USER','Tin nhắn dữ liệu mẫu số 18',1,'2026-01-19 00:00:00'),(19,19,20,'USER','Tin nhắn dữ liệu mẫu số 19',0,'2026-01-20 00:00:00'),(20,20,NULL,'AI','Tin nhắn dữ liệu mẫu số 20',1,'2026-01-21 00:00:00');
/*!40000 ALTER TABLE `Messages` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `Notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Notifications` (
  `NotificationId` int unsigned NOT NULL AUTO_INCREMENT,
  `UserId` int unsigned NOT NULL,
  `Type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Title` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Message` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ReferenceType` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ReferenceId` int unsigned DEFAULT NULL,
  `IsRead` tinyint(1) NOT NULL DEFAULT '0',
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`NotificationId`),
  KEY `notifications__user_id__is_read__created_at` (`UserId`,`IsRead`,`CreatedAt`),
  CONSTRAINT `Notifications_ibfk_1` FOREIGN KEY (`UserId`) REFERENCES `Users` (`UserId`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `Notifications` WRITE;
/*!40000 ALTER TABLE `Notifications` DISABLE KEYS */;
INSERT INTO `Notifications` VALUES (1,1,'ORDER','Thông báo 000001','Nội dung thông báo dữ liệu mẫu số 1','LISTING',1,0,'2026-01-02 00:00:00'),(2,2,'PARTNER','Thông báo 000002','Nội dung thông báo dữ liệu mẫu số 2','ORDER',2,1,'2026-01-03 00:00:00'),(3,3,'LISTING','Thông báo 000003','Nội dung thông báo dữ liệu mẫu số 3','LISTING',3,0,'2026-01-04 00:00:00'),(4,4,'VIP','Thông báo 000004','Nội dung thông báo dữ liệu mẫu số 4','ORDER',4,1,'2026-01-05 00:00:00'),(5,5,'SYSTEM','Thông báo 000005','Nội dung thông báo dữ liệu mẫu số 5','LISTING',5,0,'2026-01-06 00:00:00'),(6,6,'MESSAGE','Thông báo 000006','Nội dung thông báo dữ liệu mẫu số 6','ORDER',6,1,'2026-01-07 00:00:00'),(7,7,'ORDER','Thông báo 000007','Nội dung thông báo dữ liệu mẫu số 7','LISTING',7,0,'2026-01-08 00:00:00'),(8,8,'PARTNER','Thông báo 000008','Nội dung thông báo dữ liệu mẫu số 8','ORDER',8,1,'2026-01-09 00:00:00'),(9,9,'LISTING','Thông báo 000009','Nội dung thông báo dữ liệu mẫu số 9','LISTING',9,0,'2026-01-10 00:00:00'),(10,10,'VIP','Thông báo 000010','Nội dung thông báo dữ liệu mẫu số 10','ORDER',10,1,'2026-01-11 00:00:00'),(11,11,'SYSTEM','Thông báo 000011','Nội dung thông báo dữ liệu mẫu số 11','LISTING',11,0,'2026-01-12 00:00:00'),(12,12,'MESSAGE','Thông báo 000012','Nội dung thông báo dữ liệu mẫu số 12','ORDER',12,1,'2026-01-13 00:00:00'),(13,13,'ORDER','Thông báo 000013','Nội dung thông báo dữ liệu mẫu số 13','LISTING',13,0,'2026-01-14 00:00:00'),(14,14,'PARTNER','Thông báo 000014','Nội dung thông báo dữ liệu mẫu số 14','ORDER',14,1,'2026-01-15 00:00:00'),(15,15,'LISTING','Thông báo 000015','Nội dung thông báo dữ liệu mẫu số 15','LISTING',15,0,'2026-01-16 00:00:00'),(16,16,'VIP','Thông báo 000016','Nội dung thông báo dữ liệu mẫu số 16','ORDER',16,1,'2026-01-17 00:00:00'),(17,17,'SYSTEM','Thông báo 000017','Nội dung thông báo dữ liệu mẫu số 17','LISTING',17,0,'2026-01-18 00:00:00'),(18,18,'MESSAGE','Thông báo 000018','Nội dung thông báo dữ liệu mẫu số 18','ORDER',18,1,'2026-01-19 00:00:00'),(19,19,'ORDER','Thông báo 000019','Nội dung thông báo dữ liệu mẫu số 19','LISTING',19,0,'2026-01-20 00:00:00'),(20,20,'PARTNER','Thông báo 000020','Nội dung thông báo dữ liệu mẫu số 20','ORDER',20,1,'2026-01-21 00:00:00'),(21,3,'LISTING','Tin đăng đã được duyệt','Tin \"Sản phẩm cũ minh họa 000003\".','LISTING',3,0,'2026-10-02 06:30:13'),(22,1,'SYSTEM','Báo cáo #20 đang được xử lý','Quản trị viên đã tiếp nhận và đang xem xét báo cáo của bạn.','REPORT',20,0,'2026-10-02 06:30:26'),(23,1,'REFUND','Yêu cầu hoàn tiền đang được xem xét','Quản trị viên đã tiếp nhận yêu cầu hoàn tiền HT000020 (đơn #20).','REFUND_REQUEST',20,0,'2026-10-02 06:30:40'),(24,17,'PAYMENT','Đã xác nhận thu phí','Website đã nhận 3.350đ cho khoản HH000017.','COMMISSION',17,0,'2026-10-02 06:31:01'),(25,17,'REFUND','Yêu cầu hoàn tiền đang được xem xét','Quản trị viên đã tiếp nhận yêu cầu hoàn tiền HT000016 (đơn #16).','REFUND_REQUEST',16,0,'2026-10-02 06:31:52'),(26,3,'REFUND','Đơn #9001 có yêu cầu hoàn tiền','Người mua yêu cầu hoàn 2.500.000đ. Lý do: Sản phẩm bị lỗi, hư hỏng.','REFUND_REQUEST',21,0,'2026-10-02 06:54:36'),(27,2,'REFUND','Đơn #9001 có yêu cầu hoàn tiền','Người mua yêu cầu hoàn 2.500.000đ. Lý do: Sản phẩm bị lỗi, hư hỏng.','REFUND_REQUEST',21,0,'2026-10-02 06:54:36');
/*!40000 ALTER TABLE `Notifications` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `Orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Orders` (
  `OrderId` int unsigned NOT NULL AUTO_INCREMENT,
  `BuyerId` int unsigned NOT NULL,
  `ListingId` int unsigned NOT NULL,
  `SellerId` int unsigned NOT NULL,
  `DeliveryMethod` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ReceiverName` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ReceiverPhone` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ReceiverAddress` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ProductAmount` decimal(18,2) NOT NULL,
  `DeliveryFee` decimal(18,2) NOT NULL DEFAULT '0.00',
  `CommissionRate` decimal(5,2) NOT NULL DEFAULT '0.00',
  `TotalAmount` decimal(18,2) NOT NULL,
  `Status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'RESERVED',
  `ReservedUntil` datetime NOT NULL,
  `CancelReason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `CompletedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`OrderId`),
  KEY `ListingId` (`ListingId`),
  KEY `orders__buyer_id__status` (`BuyerId`,`Status`),
  KEY `orders__seller_id__status` (`SellerId`,`Status`),
  CONSTRAINT `Orders_ibfk_1` FOREIGN KEY (`BuyerId`) REFERENCES `Users` (`UserId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Orders_ibfk_2` FOREIGN KEY (`ListingId`) REFERENCES `Listings` (`ListingId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Orders_ibfk_3` FOREIGN KEY (`SellerId`) REFERENCES `Users` (`UserId`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9003 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `Orders` WRITE;
/*!40000 ALTER TABLE `Orders` DISABLE KEYS */;
INSERT INTO `Orders` VALUES (1,2,1,1,'PICKUP','Người nhận 000001','0800000001',NULL,51000.00,0.00,5.00,51000.00,'CONFIRMED','2026-01-03 00:00:00',NULL,'2026-01-02 00:00:00',NULL),(2,3,2,2,'DELIVERY','Người nhận 000002','0800000002','2 Đường Giao Hàng, TP. Hồ Chí Minh',52000.00,30000.00,5.00,82000.00,'DELIVERING','2026-01-04 00:00:00',NULL,'2026-01-03 00:00:00',NULL),(3,4,3,3,'PICKUP','Người nhận 000003','0800000003',NULL,53000.00,0.00,5.00,53000.00,'COMPLETED','2026-01-05 00:00:00',NULL,'2026-01-04 00:00:00','2026-01-08 00:00:00'),(4,5,4,4,'DELIVERY','Người nhận 000004','0800000004','4 Đường Giao Hàng, TP. Hồ Chí Minh',54000.00,30000.00,5.00,84000.00,'RESERVED','2026-01-06 00:00:00',NULL,'2026-01-05 00:00:00',NULL),(5,6,5,5,'PICKUP','Người nhận 000005','0800000005',NULL,55000.00,0.00,5.00,55000.00,'CONFIRMED','2026-01-07 00:00:00',NULL,'2026-01-06 00:00:00',NULL),(6,7,6,6,'DELIVERY','Người nhận 000006','0800000006','6 Đường Giao Hàng, TP. Hồ Chí Minh',56000.00,30000.00,5.00,86000.00,'DELIVERING','2026-01-08 00:00:00',NULL,'2026-01-07 00:00:00',NULL),(7,8,7,7,'PICKUP','Người nhận 000007','0800000007',NULL,57000.00,0.00,5.00,57000.00,'COMPLETED','2026-01-09 00:00:00',NULL,'2026-01-08 00:00:00','2026-01-12 00:00:00'),(8,9,8,8,'DELIVERY','Người nhận 000008','0800000008','8 Đường Giao Hàng, TP. Hồ Chí Minh',58000.00,30000.00,5.00,88000.00,'RESERVED','2026-01-10 00:00:00',NULL,'2026-01-09 00:00:00',NULL),(9,10,9,9,'PICKUP','Người nhận 000009','0800000009',NULL,59000.00,0.00,5.00,59000.00,'CONFIRMED','2026-01-11 00:00:00',NULL,'2026-01-10 00:00:00',NULL),(10,11,10,10,'DELIVERY','Người nhận 000010','0800000010','10 Đường Giao Hàng, TP. Hồ Chí Minh',60000.00,30000.00,5.00,90000.00,'DELIVERING','2026-01-12 00:00:00',NULL,'2026-01-11 00:00:00',NULL),(11,12,11,11,'PICKUP','Người nhận 000011','0800000011',NULL,61000.00,0.00,5.00,61000.00,'COMPLETED','2026-01-13 00:00:00',NULL,'2026-01-12 00:00:00','2026-01-16 00:00:00'),(12,13,12,12,'DELIVERY','Người nhận 000012','0800000012','12 Đường Giao Hàng, TP. Hồ Chí Minh',62000.00,30000.00,5.00,92000.00,'RESERVED','2026-01-14 00:00:00',NULL,'2026-01-13 00:00:00',NULL),(13,14,13,13,'PICKUP','Người nhận 000013','0800000013',NULL,63000.00,0.00,5.00,63000.00,'CONFIRMED','2026-01-15 00:00:00',NULL,'2026-01-14 00:00:00',NULL),(14,15,14,14,'DELIVERY','Người nhận 000014','0800000014','14 Đường Giao Hàng, TP. Hồ Chí Minh',64000.00,30000.00,5.00,94000.00,'DELIVERING','2026-01-16 00:00:00',NULL,'2026-01-15 00:00:00',NULL),(15,16,15,15,'PICKUP','Người nhận 000015','0800000015',NULL,65000.00,0.00,5.00,65000.00,'COMPLETED','2026-01-17 00:00:00',NULL,'2026-01-16 00:00:00','2026-01-20 00:00:00'),(16,17,16,16,'DELIVERY','Người nhận 000016','0800000016','16 Đường Giao Hàng, TP. Hồ Chí Minh',66000.00,30000.00,5.00,96000.00,'RESERVED','2026-01-18 00:00:00',NULL,'2026-01-17 00:00:00',NULL),(17,18,17,17,'PICKUP','Người nhận 000017','0800000017',NULL,67000.00,0.00,5.00,67000.00,'CONFIRMED','2026-01-19 00:00:00',NULL,'2026-01-18 00:00:00',NULL),(18,19,18,18,'DELIVERY','Người nhận 000018','0800000018','18 Đường Giao Hàng, TP. Hồ Chí Minh',68000.00,30000.00,5.00,98000.00,'DELIVERING','2026-01-20 00:00:00',NULL,'2026-01-19 00:00:00',NULL),(19,20,19,19,'PICKUP','Người nhận 000019','0800000019',NULL,69000.00,0.00,5.00,69000.00,'COMPLETED','2026-01-21 00:00:00',NULL,'2026-01-20 00:00:00','2026-01-24 00:00:00'),(20,1,20,20,'DELIVERY','Người nhận 000020','0800000020','20 Đường Giao Hàng, TP. Hồ Chí Minh',70000.00,30000.00,5.00,100000.00,'RESERVED','2026-01-22 00:00:00',NULL,'2026-01-21 00:00:00',NULL),(9001,1,3,3,'PICKUP','Người mua demo #1','0912009001',NULL,2500000.00,0.00,5.00,2500000.00,'COMPLETED','2026-10-01 06:54:38',NULL,'2026-09-30 06:54:38','2026-10-02 06:54:38'),(9002,4,3,3,'PICKUP','Người mua demo #4','0912009002',NULL,1200000.00,0.00,5.00,1200000.00,'COMPLETED','2026-10-01 06:54:38',NULL,'2026-09-30 06:54:38','2026-10-02 06:54:38');
/*!40000 ALTER TABLE `Orders` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `PartnerApplications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PartnerApplications` (
  `ApplicationId` int unsigned NOT NULL AUTO_INCREMENT,
  `UserId` int unsigned NOT NULL,
  `PartnerType` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `IdentityImageUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `IdentityNumberMasked` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `ReviewNote` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ReviewedBy` int unsigned DEFAULT NULL,
  `SubmittedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ReviewedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`ApplicationId`),
  KEY `UserId` (`UserId`),
  KEY `ReviewedBy` (`ReviewedBy`),
  CONSTRAINT `PartnerApplications_ibfk_1` FOREIGN KEY (`UserId`) REFERENCES `Users` (`UserId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `PartnerApplications_ibfk_2` FOREIGN KEY (`ReviewedBy`) REFERENCES `Users` (`UserId`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `PartnerApplications` WRITE;
/*!40000 ALTER TABLE `PartnerApplications` DISABLE KEYS */;
INSERT INTO `PartnerApplications` VALUES (1,1,'DRIVER','/demo/identity/000001.jpg','***0001','APPROVED',NULL,2,'2026-01-02 00:00:00','2026-01-04 00:00:00'),(2,2,'SELLER','/demo/identity/000002.jpg','***0002','REJECTED','Hồ sơ minh họa cần kiểm tra lại.',3,'2026-01-03 00:00:00','2026-01-05 00:00:00'),(3,3,'DRIVER','/demo/identity/000003.jpg','***0003','NEED_INFO',NULL,4,'2026-01-04 00:00:00','2026-01-06 00:00:00'),(4,4,'SELLER','/demo/identity/000004.jpg','***0004','PENDING',NULL,NULL,'2026-01-05 00:00:00',NULL),(5,5,'DRIVER','/demo/identity/000005.jpg','***0005','APPROVED',NULL,6,'2026-01-06 00:00:00','2026-01-08 00:00:00'),(6,6,'SELLER','/demo/identity/000006.jpg','***0006','REJECTED','Hồ sơ minh họa cần kiểm tra lại.',7,'2026-01-07 00:00:00','2026-01-09 00:00:00'),(7,7,'DRIVER','/demo/identity/000007.jpg','***0007','NEED_INFO',NULL,8,'2026-01-08 00:00:00','2026-01-10 00:00:00'),(8,8,'SELLER','/demo/identity/000008.jpg','***0008','PENDING',NULL,NULL,'2026-01-09 00:00:00',NULL),(9,9,'DRIVER','/demo/identity/000009.jpg','***0009','APPROVED',NULL,10,'2026-01-10 00:00:00','2026-01-12 00:00:00'),(10,10,'SELLER','/demo/identity/000010.jpg','***0010','REJECTED','Hồ sơ minh họa cần kiểm tra lại.',11,'2026-01-11 00:00:00','2026-01-13 00:00:00'),(11,11,'DRIVER','/demo/identity/000011.jpg','***0011','NEED_INFO',NULL,12,'2026-01-12 00:00:00','2026-01-14 00:00:00'),(12,12,'SELLER','/demo/identity/000012.jpg','***0012','PENDING',NULL,NULL,'2026-01-13 00:00:00',NULL),(13,13,'DRIVER','/demo/identity/000013.jpg','***0013','APPROVED',NULL,14,'2026-01-14 00:00:00','2026-01-16 00:00:00'),(14,14,'SELLER','/demo/identity/000014.jpg','***0014','REJECTED','Hồ sơ minh họa cần kiểm tra lại.',15,'2026-01-15 00:00:00','2026-01-17 00:00:00'),(15,15,'DRIVER','/demo/identity/000015.jpg','***0015','NEED_INFO',NULL,16,'2026-01-16 00:00:00','2026-01-18 00:00:00'),(16,16,'SELLER','/demo/identity/000016.jpg','***0016','PENDING',NULL,NULL,'2026-01-17 00:00:00',NULL),(17,17,'DRIVER','/demo/identity/000017.jpg','***0017','APPROVED',NULL,18,'2026-01-18 00:00:00','2026-01-20 00:00:00'),(18,18,'SELLER','/demo/identity/000018.jpg','***0018','REJECTED','Hồ sơ minh họa cần kiểm tra lại.',19,'2026-01-19 00:00:00','2026-01-21 00:00:00'),(19,19,'DRIVER','/demo/identity/000019.jpg','***0019','NEED_INFO',NULL,20,'2026-01-20 00:00:00','2026-01-22 00:00:00'),(20,20,'SELLER','/demo/identity/000020.jpg','***0020','PENDING',NULL,NULL,'2026-01-21 00:00:00',NULL);
/*!40000 ALTER TABLE `PartnerApplications` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `Payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Payments` (
  `PaymentId` int unsigned NOT NULL AUTO_INCREMENT,
  `OrderId` int unsigned NOT NULL,
  `PayerId` int unsigned NOT NULL,
  `PayeeId` int unsigned NOT NULL,
  `Amount` decimal(18,2) NOT NULL,
  `BankName` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `BankAccountSnapshot` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `TransferContent` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ProofUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'WAITING',
  `ReportedAt` datetime DEFAULT NULL,
  `ConfirmedBy` int unsigned DEFAULT NULL,
  `ConfirmedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`PaymentId`),
  UNIQUE KEY `OrderId` (`OrderId`),
  KEY `PayerId` (`PayerId`),
  KEY `PayeeId` (`PayeeId`),
  KEY `ConfirmedBy` (`ConfirmedBy`),
  CONSTRAINT `Payments_ibfk_1` FOREIGN KEY (`OrderId`) REFERENCES `Orders` (`OrderId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Payments_ibfk_2` FOREIGN KEY (`PayerId`) REFERENCES `Users` (`UserId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Payments_ibfk_3` FOREIGN KEY (`PayeeId`) REFERENCES `Users` (`UserId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Payments_ibfk_4` FOREIGN KEY (`ConfirmedBy`) REFERENCES `Users` (`UserId`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `Payments` WRITE;
/*!40000 ALTER TABLE `Payments` DISABLE KEYS */;
INSERT INTO `Payments` VALUES (1,1,2,1,51000.00,'Ngân hàng demo 1','100000000001','CHO DO CU DON 000001','/demo/payment-proof/000001.jpg','REPORTED','2026-01-02 00:00:00',NULL,NULL),(2,2,3,2,52000.00,'Ngân hàng demo 2','100000000002','CHO DO CU DON 000002','/demo/payment-proof/000002.jpg','CONFIRMED','2026-01-03 00:00:00',2,'2026-01-04 00:00:00'),(3,3,4,3,53000.00,'Ngân hàng demo 3','100000000003','CHO DO CU DON 000003','/demo/payment-proof/000003.jpg','REJECTED','2026-01-04 00:00:00',3,'2026-01-05 00:00:00'),(4,4,5,4,54000.00,'Ngân hàng demo 4','100000000004','CHO DO CU DON 000004','/demo/payment-proof/000004.jpg','WAITING','2026-01-05 00:00:00',NULL,NULL),(5,5,6,5,55000.00,'Ngân hàng demo 5','100000000005','CHO DO CU DON 000005','/demo/payment-proof/000005.jpg','REPORTED','2026-01-06 00:00:00',NULL,NULL),(6,6,7,6,56000.00,'Ngân hàng demo 6','100000000006','CHO DO CU DON 000006','/demo/payment-proof/000006.jpg','CONFIRMED','2026-01-07 00:00:00',6,'2026-01-08 00:00:00'),(7,7,8,7,57000.00,'Ngân hàng demo 7','100000000007','CHO DO CU DON 000007','/demo/payment-proof/000007.jpg','REJECTED','2026-01-08 00:00:00',7,'2026-01-09 00:00:00'),(8,8,9,8,58000.00,'Ngân hàng demo 8','100000000008','CHO DO CU DON 000008','/demo/payment-proof/000008.jpg','WAITING','2026-01-09 00:00:00',NULL,NULL),(9,9,10,9,59000.00,'Ngân hàng demo 9','100000000009','CHO DO CU DON 000009','/demo/payment-proof/000009.jpg','REPORTED','2026-01-10 00:00:00',NULL,NULL),(10,10,11,10,60000.00,'Ngân hàng demo 0','100000000010','CHO DO CU DON 000010','/demo/payment-proof/000010.jpg','CONFIRMED','2026-01-11 00:00:00',10,'2026-01-12 00:00:00'),(11,11,12,11,61000.00,'Ngân hàng demo 1','100000000011','CHO DO CU DON 000011','/demo/payment-proof/000011.jpg','REJECTED','2026-01-12 00:00:00',11,'2026-01-13 00:00:00'),(12,12,13,12,62000.00,'Ngân hàng demo 2','100000000012','CHO DO CU DON 000012','/demo/payment-proof/000012.jpg','WAITING','2026-01-13 00:00:00',NULL,NULL),(13,13,14,13,63000.00,'Ngân hàng demo 3','100000000013','CHO DO CU DON 000013','/demo/payment-proof/000013.jpg','REPORTED','2026-01-14 00:00:00',NULL,NULL),(14,14,15,14,64000.00,'Ngân hàng demo 4','100000000014','CHO DO CU DON 000014','/demo/payment-proof/000014.jpg','CONFIRMED','2026-01-15 00:00:00',14,'2026-01-16 00:00:00'),(15,15,16,15,65000.00,'Ngân hàng demo 5','100000000015','CHO DO CU DON 000015','/demo/payment-proof/000015.jpg','REJECTED','2026-01-16 00:00:00',15,'2026-01-17 00:00:00'),(16,16,17,16,66000.00,'Ngân hàng demo 6','100000000016','CHO DO CU DON 000016','/demo/payment-proof/000016.jpg','WAITING','2026-01-17 00:00:00',NULL,NULL),(17,17,18,17,67000.00,'Ngân hàng demo 7','100000000017','CHO DO CU DON 000017','/demo/payment-proof/000017.jpg','REPORTED','2026-01-18 00:00:00',NULL,NULL),(18,18,19,18,68000.00,'Ngân hàng demo 8','100000000018','CHO DO CU DON 000018','/demo/payment-proof/000018.jpg','CONFIRMED','2026-01-19 00:00:00',18,'2026-01-20 00:00:00'),(19,19,20,19,69000.00,'Ngân hàng demo 9','100000000019','CHO DO CU DON 000019','/demo/payment-proof/000019.jpg','REJECTED','2026-01-20 00:00:00',19,'2026-01-21 00:00:00'),(20,20,1,20,70000.00,'Ngân hàng demo 0','100000000020','CHO DO CU DON 000020','/demo/payment-proof/000020.jpg','WAITING','2026-01-21 00:00:00',NULL,NULL),(25,9001,1,3,2500000.00,'Vietcombank','1000000003','CHO DO CU DON 9001',NULL,'CONFIRMED','2026-09-30 06:54:38',3,'2026-10-01 06:54:38'),(26,9002,4,3,1200000.00,'Vietcombank','1000000003','CHO DO CU DON 9002',NULL,'CONFIRMED','2026-09-30 06:54:38',3,'2026-10-01 06:54:38');
/*!40000 ALTER TABLE `Payments` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `RefundRequests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `RefundRequests` (
  `RefundRequestId` int unsigned NOT NULL AUTO_INCREMENT,
  `OrderId` int unsigned NOT NULL,
  `RequestedBy` int unsigned NOT NULL,
  `Reason` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `EvidenceUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Amount` decimal(18,2) NOT NULL,
  `RefundProofUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `AdminNote` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ReviewedBy` int unsigned DEFAULT NULL,
  `RequestedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ReviewedAt` datetime DEFAULT NULL,
  `CompletedAt` datetime DEFAULT NULL,
  `OrderStatusBefore` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Description` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `SellerResponse` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `SellerRespondedAt` datetime DEFAULT NULL,
  `RefundBankCode` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `RefundAccountNumber` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `RefundAccountHolder` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `RefundTransactionCode` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`RefundRequestId`),
  KEY `OrderId` (`OrderId`),
  KEY `RequestedBy` (`RequestedBy`),
  KEY `ReviewedBy` (`ReviewedBy`),
  CONSTRAINT `RefundRequests_ibfk_1` FOREIGN KEY (`OrderId`) REFERENCES `Orders` (`OrderId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `RefundRequests_ibfk_2` FOREIGN KEY (`RequestedBy`) REFERENCES `Users` (`UserId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `RefundRequests_ibfk_3` FOREIGN KEY (`ReviewedBy`) REFERENCES `Users` (`UserId`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `RefundRequests` WRITE;
/*!40000 ALTER TABLE `RefundRequests` DISABLE KEYS */;
INSERT INTO `RefundRequests` VALUES (1,1,2,'Yêu cầu hoàn tiền minh họa số 1','/demo/refund-evidence/000001.jpg',51000.00,NULL,'APPROVED',NULL,2,'2026-01-02 00:00:00','2026-01-03 00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(2,2,3,'Yêu cầu hoàn tiền minh họa số 2','/demo/refund-evidence/000002.jpg',52000.00,NULL,'REJECTED','Không đủ bằng chứng trong dữ liệu mẫu.',3,'2026-01-03 00:00:00','2026-01-04 00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(3,3,4,'Yêu cầu hoàn tiền minh họa số 3','/demo/refund-evidence/000003.jpg',53000.00,'/demo/refund-proof/000003.jpg','COMPLETED',NULL,4,'2026-01-04 00:00:00','2026-01-05 00:00:00','2026-01-07 00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(4,4,5,'Yêu cầu hoàn tiền minh họa số 4','/demo/refund-evidence/000004.jpg',54000.00,NULL,'PENDING',NULL,NULL,'2026-01-05 00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(5,5,6,'Yêu cầu hoàn tiền minh họa số 5','/demo/refund-evidence/000005.jpg',55000.00,NULL,'APPROVED',NULL,6,'2026-01-06 00:00:00','2026-01-07 00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(6,6,7,'Yêu cầu hoàn tiền minh họa số 6','/demo/refund-evidence/000006.jpg',56000.00,'/demo/refund-proof/000006.jpg','REJECTED','Không đủ bằng chứng trong dữ liệu mẫu.',7,'2026-01-07 00:00:00','2026-01-08 00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(7,7,8,'Yêu cầu hoàn tiền minh họa số 7','/demo/refund-evidence/000007.jpg',57000.00,NULL,'COMPLETED',NULL,8,'2026-01-08 00:00:00','2026-01-09 00:00:00','2026-01-11 00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(8,8,9,'Yêu cầu hoàn tiền minh họa số 8','/demo/refund-evidence/000008.jpg',58000.00,NULL,'PENDING',NULL,NULL,'2026-01-09 00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(9,9,10,'Yêu cầu hoàn tiền minh họa số 9','/demo/refund-evidence/000009.jpg',59000.00,'/demo/refund-proof/000009.jpg','APPROVED',NULL,10,'2026-01-10 00:00:00','2026-01-11 00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(10,10,11,'Yêu cầu hoàn tiền minh họa số 10','/demo/refund-evidence/000010.jpg',60000.00,NULL,'REJECTED','Không đủ bằng chứng trong dữ liệu mẫu.',11,'2026-01-11 00:00:00','2026-01-12 00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(11,11,12,'Yêu cầu hoàn tiền minh họa số 11','/demo/refund-evidence/000011.jpg',61000.00,NULL,'COMPLETED',NULL,12,'2026-01-12 00:00:00','2026-01-13 00:00:00','2026-01-15 00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(12,12,13,'Yêu cầu hoàn tiền minh họa số 12','/demo/refund-evidence/000012.jpg',62000.00,'/demo/refund-proof/000012.jpg','PENDING',NULL,NULL,'2026-01-13 00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(13,13,14,'Yêu cầu hoàn tiền minh họa số 13','/demo/refund-evidence/000013.jpg',63000.00,NULL,'APPROVED',NULL,14,'2026-01-14 00:00:00','2026-01-15 00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(14,14,15,'Yêu cầu hoàn tiền minh họa số 14','/demo/refund-evidence/000014.jpg',64000.00,NULL,'REJECTED','Không đủ bằng chứng trong dữ liệu mẫu.',15,'2026-01-15 00:00:00','2026-01-16 00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(15,15,16,'Yêu cầu hoàn tiền minh họa số 15','/demo/refund-evidence/000015.jpg',65000.00,'/demo/refund-proof/000015.jpg','COMPLETED',NULL,16,'2026-01-16 00:00:00','2026-01-17 00:00:00','2026-01-19 00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(16,16,17,'Yêu cầu hoàn tiền minh họa số 16','/demo/refund-evidence/000016.jpg',66000.00,NULL,'REVIEWING',NULL,2,'2026-01-17 00:00:00','2026-10-02 06:31:52',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(17,17,18,'Yêu cầu hoàn tiền minh họa số 17','/demo/refund-evidence/000017.jpg',67000.00,NULL,'APPROVED',NULL,18,'2026-01-18 00:00:00','2026-01-19 00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(18,18,19,'Yêu cầu hoàn tiền minh họa số 18','/demo/refund-evidence/000018.jpg',68000.00,'/demo/refund-proof/000018.jpg','REJECTED','Không đủ bằng chứng trong dữ liệu mẫu.',19,'2026-01-19 00:00:00','2026-01-20 00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(19,19,20,'Yêu cầu hoàn tiền minh họa số 19','/demo/refund-evidence/000019.jpg',69000.00,NULL,'COMPLETED',NULL,20,'2026-01-20 00:00:00','2026-01-21 00:00:00','2026-01-23 00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(20,20,1,'Yêu cầu hoàn tiền minh họa số 20','/demo/refund-evidence/000020.jpg',70000.00,NULL,'REVIEWING',NULL,2,'2026-01-21 00:00:00','2026-10-02 06:30:40',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `RefundRequests` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `Reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Reports` (
  `ReportId` int unsigned NOT NULL AUTO_INCREMENT,
  `ReporterId` int unsigned NOT NULL,
  `ListingId` int unsigned DEFAULT NULL,
  `ReportedUserId` int unsigned DEFAULT NULL,
  `OrderId` int unsigned DEFAULT NULL,
  `Reason` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Description` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `EvidenceUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `HandledBy` int unsigned DEFAULT NULL,
  `Resolution` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `HandledAt` datetime DEFAULT NULL,
  PRIMARY KEY (`ReportId`),
  KEY `ReporterId` (`ReporterId`),
  KEY `ListingId` (`ListingId`),
  KEY `ReportedUserId` (`ReportedUserId`),
  KEY `OrderId` (`OrderId`),
  KEY `HandledBy` (`HandledBy`),
  KEY `reports__status__created_at` (`Status`,`CreatedAt`),
  CONSTRAINT `Reports_ibfk_1` FOREIGN KEY (`ReporterId`) REFERENCES `Users` (`UserId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Reports_ibfk_2` FOREIGN KEY (`ListingId`) REFERENCES `Listings` (`ListingId`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Reports_ibfk_3` FOREIGN KEY (`ReportedUserId`) REFERENCES `Users` (`UserId`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Reports_ibfk_4` FOREIGN KEY (`OrderId`) REFERENCES `Orders` (`OrderId`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Reports_ibfk_5` FOREIGN KEY (`HandledBy`) REFERENCES `Users` (`UserId`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `Reports` WRITE;
/*!40000 ALTER TABLE `Reports` DISABLE KEYS */;
INSERT INTO `Reports` VALUES (1,2,1,1,1,'Nghi ngờ lừa đảo','Nội dung báo cáo minh họa số 1','/demo/report-evidence/000001.jpg','PROCESSING',2,NULL,'2026-01-02 00:00:00',NULL),(2,3,2,2,2,'Sản phẩm cấm','Nội dung báo cáo minh họa số 2','/demo/report-evidence/000002.jpg','RESOLVED',3,'Đã xử lý dữ liệu báo cáo mẫu.','2026-01-03 00:00:00','2026-01-05 00:00:00'),(3,4,3,3,3,'Sai mô tả','Nội dung báo cáo minh họa số 3','/demo/report-evidence/000003.jpg','REJECTED',4,NULL,'2026-01-04 00:00:00','2026-01-06 00:00:00'),(4,5,4,4,4,'Nghi ngờ lừa đảo','Nội dung báo cáo minh họa số 4','/demo/report-evidence/000004.jpg','PENDING',NULL,NULL,'2026-01-05 00:00:00',NULL),(5,6,5,5,5,'Sản phẩm cấm','Nội dung báo cáo minh họa số 5','/demo/report-evidence/000005.jpg','PROCESSING',6,NULL,'2026-01-06 00:00:00',NULL),(6,7,6,6,6,'Sai mô tả','Nội dung báo cáo minh họa số 6','/demo/report-evidence/000006.jpg','RESOLVED',7,'Đã xử lý dữ liệu báo cáo mẫu.','2026-01-07 00:00:00','2026-01-09 00:00:00'),(7,8,7,7,7,'Nghi ngờ lừa đảo','Nội dung báo cáo minh họa số 7','/demo/report-evidence/000007.jpg','REJECTED',8,NULL,'2026-01-08 00:00:00','2026-01-10 00:00:00'),(8,9,8,8,8,'Sản phẩm cấm','Nội dung báo cáo minh họa số 8','/demo/report-evidence/000008.jpg','PENDING',NULL,NULL,'2026-01-09 00:00:00',NULL),(9,10,9,9,9,'Sai mô tả','Nội dung báo cáo minh họa số 9','/demo/report-evidence/000009.jpg','PROCESSING',10,NULL,'2026-01-10 00:00:00',NULL),(10,11,10,10,10,'Nghi ngờ lừa đảo','Nội dung báo cáo minh họa số 10','/demo/report-evidence/000010.jpg','RESOLVED',11,'Đã xử lý dữ liệu báo cáo mẫu.','2026-01-11 00:00:00','2026-01-13 00:00:00'),(11,12,11,11,11,'Sản phẩm cấm','Nội dung báo cáo minh họa số 11','/demo/report-evidence/000011.jpg','REJECTED',12,NULL,'2026-01-12 00:00:00','2026-01-14 00:00:00'),(12,13,12,12,12,'Sai mô tả','Nội dung báo cáo minh họa số 12','/demo/report-evidence/000012.jpg','PENDING',NULL,NULL,'2026-01-13 00:00:00',NULL),(13,14,13,13,13,'Nghi ngờ lừa đảo','Nội dung báo cáo minh họa số 13','/demo/report-evidence/000013.jpg','PROCESSING',14,NULL,'2026-01-14 00:00:00',NULL),(14,15,14,14,14,'Sản phẩm cấm','Nội dung báo cáo minh họa số 14','/demo/report-evidence/000014.jpg','RESOLVED',15,'Đã xử lý dữ liệu báo cáo mẫu.','2026-01-15 00:00:00','2026-01-17 00:00:00'),(15,16,15,15,15,'Sai mô tả','Nội dung báo cáo minh họa số 15','/demo/report-evidence/000015.jpg','REJECTED',16,NULL,'2026-01-16 00:00:00','2026-01-18 00:00:00'),(16,17,16,16,16,'Nghi ngờ lừa đảo','Nội dung báo cáo minh họa số 16','/demo/report-evidence/000016.jpg','PENDING',NULL,NULL,'2026-01-17 00:00:00',NULL),(17,18,17,17,17,'Sản phẩm cấm','Nội dung báo cáo minh họa số 17','/demo/report-evidence/000017.jpg','PROCESSING',18,NULL,'2026-01-18 00:00:00',NULL),(18,19,18,18,18,'Sai mô tả','Nội dung báo cáo minh họa số 18','/demo/report-evidence/000018.jpg','RESOLVED',19,'Đã xử lý dữ liệu báo cáo mẫu.','2026-01-19 00:00:00','2026-01-21 00:00:00'),(19,20,19,19,19,'Nghi ngờ lừa đảo','Nội dung báo cáo minh họa số 19','/demo/report-evidence/000019.jpg','REJECTED',20,NULL,'2026-01-20 00:00:00','2026-01-22 00:00:00'),(20,1,20,20,20,'Sản phẩm cấm','Nội dung báo cáo minh họa số 20','/demo/report-evidence/000020.jpg','PROCESSING',2,NULL,'2026-01-21 00:00:00',NULL);
/*!40000 ALTER TABLE `Reports` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `Reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Reviews` (
  `ReviewId` int unsigned NOT NULL AUTO_INCREMENT,
  `OrderId` int unsigned NOT NULL,
  `ReviewerId` int unsigned NOT NULL,
  `TargetUserId` int unsigned NOT NULL,
  `TargetType` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Rating` tinyint unsigned NOT NULL,
  `Comment` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Reply` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ReplyAt` datetime DEFAULT NULL,
  PRIMARY KEY (`ReviewId`),
  KEY `OrderId` (`OrderId`),
  KEY `ReviewerId` (`ReviewerId`),
  KEY `TargetUserId` (`TargetUserId`),
  CONSTRAINT `Reviews_ibfk_1` FOREIGN KEY (`OrderId`) REFERENCES `Orders` (`OrderId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Reviews_ibfk_2` FOREIGN KEY (`ReviewerId`) REFERENCES `Users` (`UserId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Reviews_ibfk_3` FOREIGN KEY (`TargetUserId`) REFERENCES `Users` (`UserId`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `Reviews` WRITE;
/*!40000 ALTER TABLE `Reviews` DISABLE KEYS */;
INSERT INTO `Reviews` VALUES (1,1,2,1,'DRIVER',2,'Đánh giá minh họa số 1',NULL,'2026-01-02 00:00:00',NULL),(2,2,3,2,'SELLER',3,'Đánh giá minh họa số 2',NULL,'2026-01-03 00:00:00',NULL),(3,3,4,3,'DRIVER',4,'Đánh giá minh họa số 3','Phản hồi minh họa số 3','2026-01-04 00:00:00','2026-01-05 00:00:00'),(4,4,5,4,'SELLER',5,'Đánh giá minh họa số 4',NULL,'2026-01-05 00:00:00',NULL),(5,5,6,5,'DRIVER',1,'Đánh giá minh họa số 5',NULL,'2026-01-06 00:00:00',NULL),(6,6,7,6,'SELLER',2,'Đánh giá minh họa số 6','Phản hồi minh họa số 6','2026-01-07 00:00:00','2026-01-08 00:00:00'),(7,7,8,7,'DRIVER',3,'Đánh giá minh họa số 7',NULL,'2026-01-08 00:00:00',NULL),(8,8,9,8,'SELLER',4,'Đánh giá minh họa số 8',NULL,'2026-01-09 00:00:00',NULL),(9,9,10,9,'DRIVER',5,'Đánh giá minh họa số 9','Phản hồi minh họa số 9','2026-01-10 00:00:00','2026-01-11 00:00:00'),(10,10,11,10,'SELLER',1,'Đánh giá minh họa số 10',NULL,'2026-01-11 00:00:00',NULL),(11,11,12,11,'DRIVER',2,'Đánh giá minh họa số 11',NULL,'2026-01-12 00:00:00',NULL),(12,12,13,12,'SELLER',3,'Đánh giá minh họa số 12','Phản hồi minh họa số 12','2026-01-13 00:00:00','2026-01-14 00:00:00'),(13,13,14,13,'DRIVER',4,'Đánh giá minh họa số 13',NULL,'2026-01-14 00:00:00',NULL),(14,14,15,14,'SELLER',5,'Đánh giá minh họa số 14',NULL,'2026-01-15 00:00:00',NULL),(15,15,16,15,'DRIVER',1,'Đánh giá minh họa số 15','Phản hồi minh họa số 15','2026-01-16 00:00:00','2026-01-17 00:00:00'),(16,16,17,16,'SELLER',2,'Đánh giá minh họa số 16',NULL,'2026-01-17 00:00:00',NULL),(17,17,18,17,'DRIVER',3,'Đánh giá minh họa số 17',NULL,'2026-01-18 00:00:00',NULL),(18,18,19,18,'SELLER',4,'Đánh giá minh họa số 18','Phản hồi minh họa số 18','2026-01-19 00:00:00','2026-01-20 00:00:00'),(19,19,20,19,'DRIVER',5,'Đánh giá minh họa số 19',NULL,'2026-01-20 00:00:00',NULL),(20,20,1,20,'SELLER',1,'Đánh giá minh họa số 20',NULL,'2026-01-21 00:00:00',NULL);
/*!40000 ALTER TABLE `Reviews` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `Roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Roles` (
  `RoleId` int unsigned NOT NULL AUTO_INCREMENT,
  `RoleName` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Description` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`RoleId`),
  UNIQUE KEY `RoleName` (`RoleName`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `Roles` WRITE;
/*!40000 ALTER TABLE `Roles` DISABLE KEYS */;
INSERT INTO `Roles` VALUES (1,'USER','Vai trò dữ liệu mẫu số 1'),(2,'ADMIN','Vai trò dữ liệu mẫu số 2'),(3,'SELLER','Vai trò dữ liệu mẫu số 3'),(4,'DRIVER','Vai trò dữ liệu mẫu số 4'),(5,'ROLE_DEMO_000005','Vai trò dữ liệu mẫu số 5'),(6,'ROLE_DEMO_000006','Vai trò dữ liệu mẫu số 6'),(7,'ROLE_DEMO_000007','Vai trò dữ liệu mẫu số 7'),(8,'ROLE_DEMO_000008','Vai trò dữ liệu mẫu số 8'),(9,'ROLE_DEMO_000009','Vai trò dữ liệu mẫu số 9'),(10,'ROLE_DEMO_000010','Vai trò dữ liệu mẫu số 10'),(11,'ROLE_DEMO_000011','Vai trò dữ liệu mẫu số 11'),(12,'ROLE_DEMO_000012','Vai trò dữ liệu mẫu số 12'),(13,'ROLE_DEMO_000013','Vai trò dữ liệu mẫu số 13'),(14,'ROLE_DEMO_000014','Vai trò dữ liệu mẫu số 14'),(15,'ROLE_DEMO_000015','Vai trò dữ liệu mẫu số 15'),(16,'ROLE_DEMO_000016','Vai trò dữ liệu mẫu số 16'),(17,'ROLE_DEMO_000017','Vai trò dữ liệu mẫu số 17'),(18,'ROLE_DEMO_000018','Vai trò dữ liệu mẫu số 18'),(19,'ROLE_DEMO_000019','Vai trò dữ liệu mẫu số 19'),(20,'ROLE_DEMO_000020','Vai trò dữ liệu mẫu số 20');
/*!40000 ALTER TABLE `Roles` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `SequelizeMeta`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SequelizeMeta` (
  `name` varchar(255) COLLATE utf8mb3_unicode_ci NOT NULL,
  PRIMARY KEY (`name`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `SequelizeMeta` WRITE;
/*!40000 ALTER TABLE `SequelizeMeta` DISABLE KEYS */;
INSERT INTO `SequelizeMeta` VALUES ('20260916000100-create-cho-do-cu-schema.js'),('20260930000100-create-admin-audit-and-settings.js'),('20261002000100-member-b-report-v2.js');
/*!40000 ALTER TABLE `SequelizeMeta` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `StatusHistories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `StatusHistories` (
  `HistoryId` int unsigned NOT NULL AUTO_INCREMENT,
  `OrderId` int unsigned NOT NULL,
  `DeliveryId` int unsigned DEFAULT NULL,
  `StatusType` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `StatusValue` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ChangedBy` int unsigned DEFAULT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`HistoryId`),
  KEY `OrderId` (`OrderId`),
  KEY `DeliveryId` (`DeliveryId`),
  KEY `ChangedBy` (`ChangedBy`),
  CONSTRAINT `StatusHistories_ibfk_1` FOREIGN KEY (`OrderId`) REFERENCES `Orders` (`OrderId`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `StatusHistories_ibfk_2` FOREIGN KEY (`DeliveryId`) REFERENCES `Deliveries` (`DeliveryId`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `StatusHistories_ibfk_3` FOREIGN KEY (`ChangedBy`) REFERENCES `Users` (`UserId`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `StatusHistories` WRITE;
/*!40000 ALTER TABLE `StatusHistories` DISABLE KEYS */;
INSERT INTO `StatusHistories` VALUES (1,1,1,'PAYMENT','REPORTED','Lịch sử trạng thái minh họa số 1',2,'2026-01-02 00:00:00'),(2,2,2,'REFUND','APPROVED','Lịch sử trạng thái minh họa số 2',3,'2026-01-03 00:00:00'),(3,3,3,'DELIVERY','DELIVERING','Lịch sử trạng thái minh họa số 3',4,'2026-01-04 00:00:00'),(4,4,4,'ORDER','CONFIRMED','Lịch sử trạng thái minh họa số 4',5,'2026-01-05 00:00:00'),(5,5,5,'PAYMENT','REPORTED','Lịch sử trạng thái minh họa số 5',6,'2026-01-06 00:00:00'),(6,6,6,'REFUND','APPROVED','Lịch sử trạng thái minh họa số 6',7,'2026-01-07 00:00:00'),(7,7,7,'DELIVERY','DELIVERING','Lịch sử trạng thái minh họa số 7',8,'2026-01-08 00:00:00'),(8,8,8,'ORDER','CONFIRMED','Lịch sử trạng thái minh họa số 8',9,'2026-01-09 00:00:00'),(9,9,9,'PAYMENT','REPORTED','Lịch sử trạng thái minh họa số 9',10,'2026-01-10 00:00:00'),(10,10,10,'REFUND','APPROVED','Lịch sử trạng thái minh họa số 10',11,'2026-01-11 00:00:00'),(11,11,11,'DELIVERY','DELIVERING','Lịch sử trạng thái minh họa số 11',12,'2026-01-12 00:00:00'),(12,12,12,'ORDER','CONFIRMED','Lịch sử trạng thái minh họa số 12',13,'2026-01-13 00:00:00'),(13,13,13,'PAYMENT','REPORTED','Lịch sử trạng thái minh họa số 13',14,'2026-01-14 00:00:00'),(14,14,14,'REFUND','APPROVED','Lịch sử trạng thái minh họa số 14',15,'2026-01-15 00:00:00'),(15,15,15,'DELIVERY','DELIVERING','Lịch sử trạng thái minh họa số 15',16,'2026-01-16 00:00:00'),(16,16,16,'ORDER','CONFIRMED','Lịch sử trạng thái minh họa số 16',17,'2026-01-17 00:00:00'),(17,17,17,'PAYMENT','REPORTED','Lịch sử trạng thái minh họa số 17',18,'2026-01-18 00:00:00'),(18,18,18,'REFUND','APPROVED','Lịch sử trạng thái minh họa số 18',19,'2026-01-19 00:00:00'),(19,19,19,'DELIVERY','DELIVERING','Lịch sử trạng thái minh họa số 19',20,'2026-01-20 00:00:00'),(20,20,20,'ORDER','CONFIRMED','Lịch sử trạng thái minh họa số 20',1,'2026-01-21 00:00:00'),(21,20,NULL,'REFUND','REVIEWING',NULL,2,'2026-10-02 06:30:40'),(22,16,NULL,'REFUND','REVIEWING',NULL,2,'2026-10-02 06:31:52');
/*!40000 ALTER TABLE `StatusHistories` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `Stores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Stores` (
  `StoreId` int unsigned NOT NULL AUTO_INCREMENT,
  `OwnerId` int unsigned NOT NULL,
  `StoreName` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Latitude` decimal(10,7) DEFAULT NULL,
  `Longitude` decimal(10,7) DEFAULT NULL,
  `IsDemoLocation` tinyint(1) NOT NULL DEFAULT '1',
  `BankName` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `BankAccountNumber` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `BankAccountHolder` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `QrImageUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (`StoreId`),
  UNIQUE KEY `OwnerId` (`OwnerId`),
  CONSTRAINT `Stores_ibfk_1` FOREIGN KEY (`OwnerId`) REFERENCES `Users` (`UserId`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `Stores` WRITE;
/*!40000 ALTER TABLE `Stores` DISABLE KEYS */;
INSERT INTO `Stores` VALUES (1,1,'Gian hàng đồ cũ 000001','Gian hàng minh họa số 1','1 Đường Minh Họa, TP. Hồ Chí Minh',10.7001000,106.6001000,1,'Ngân hàng demo 1','100000000001','NGUOI DUNG 000001','/demo/qr/000001.png','ACTIVE'),(2,2,'Gian hàng đồ cũ 000002','Gian hàng minh họa số 2','2 Đường Minh Họa, TP. Hồ Chí Minh',10.7002000,106.6002000,1,'Ngân hàng demo 2','100000000002','NGUOI DUNG 000002','/demo/qr/000002.png','ACTIVE'),(3,3,'Gian hàng đồ cũ 000003','Gian hàng minh họa số 3','3 Đường Minh Họa, TP. Hồ Chí Minh',10.7003000,106.6003000,1,'Ngân hàng demo 3','100000000003','NGUOI DUNG 000003','/demo/qr/000003.png','ACTIVE'),(4,4,'Gian hàng đồ cũ 000004','Gian hàng minh họa số 4','4 Đường Minh Họa, TP. Hồ Chí Minh',10.7004000,106.6004000,1,'Ngân hàng demo 4','100000000004','NGUOI DUNG 000004','/demo/qr/000004.png','ACTIVE'),(5,5,'Gian hàng đồ cũ 000005','Gian hàng minh họa số 5','5 Đường Minh Họa, TP. Hồ Chí Minh',10.7005000,106.6005000,1,'Ngân hàng demo 5','100000000005','NGUOI DUNG 000005','/demo/qr/000005.png','ACTIVE'),(6,6,'Gian hàng đồ cũ 000006','Gian hàng minh họa số 6','6 Đường Minh Họa, TP. Hồ Chí Minh',10.7006000,106.6006000,1,'Ngân hàng demo 6','100000000006','NGUOI DUNG 000006','/demo/qr/000006.png','ACTIVE'),(7,7,'Gian hàng đồ cũ 000007','Gian hàng minh họa số 7','7 Đường Minh Họa, TP. Hồ Chí Minh',10.7007000,106.6007000,1,'Ngân hàng demo 7','100000000007','NGUOI DUNG 000007','/demo/qr/000007.png','ACTIVE'),(8,8,'Gian hàng đồ cũ 000008','Gian hàng minh họa số 8','8 Đường Minh Họa, TP. Hồ Chí Minh',10.7008000,106.6008000,1,'Ngân hàng demo 8','100000000008','NGUOI DUNG 000008','/demo/qr/000008.png','ACTIVE'),(9,9,'Gian hàng đồ cũ 000009','Gian hàng minh họa số 9','9 Đường Minh Họa, TP. Hồ Chí Minh',10.7009000,106.6009000,1,'Ngân hàng demo 9','100000000009','NGUOI DUNG 000009','/demo/qr/000009.png','ACTIVE'),(10,10,'Gian hàng đồ cũ 000010','Gian hàng minh họa số 10','10 Đường Minh Họa, TP. Hồ Chí Minh',10.7010000,106.6010000,1,'Ngân hàng demo 0','100000000010','NGUOI DUNG 000010','/demo/qr/000010.png','ACTIVE'),(11,11,'Gian hàng đồ cũ 000011','Gian hàng minh họa số 11','11 Đường Minh Họa, TP. Hồ Chí Minh',10.7011000,106.6011000,1,'Ngân hàng demo 1','100000000011','NGUOI DUNG 000011','/demo/qr/000011.png','ACTIVE'),(12,12,'Gian hàng đồ cũ 000012','Gian hàng minh họa số 12','12 Đường Minh Họa, TP. Hồ Chí Minh',10.7012000,106.6012000,1,'Ngân hàng demo 2','100000000012','NGUOI DUNG 000012','/demo/qr/000012.png','ACTIVE'),(13,13,'Gian hàng đồ cũ 000013','Gian hàng minh họa số 13','13 Đường Minh Họa, TP. Hồ Chí Minh',10.7013000,106.6013000,1,'Ngân hàng demo 3','100000000013','NGUOI DUNG 000013','/demo/qr/000013.png','ACTIVE'),(14,14,'Gian hàng đồ cũ 000014','Gian hàng minh họa số 14','14 Đường Minh Họa, TP. Hồ Chí Minh',10.7014000,106.6014000,1,'Ngân hàng demo 4','100000000014','NGUOI DUNG 000014','/demo/qr/000014.png','ACTIVE'),(15,15,'Gian hàng đồ cũ 000015','Gian hàng minh họa số 15','15 Đường Minh Họa, TP. Hồ Chí Minh',10.7015000,106.6015000,1,'Ngân hàng demo 5','100000000015','NGUOI DUNG 000015','/demo/qr/000015.png','ACTIVE'),(16,16,'Gian hàng đồ cũ 000016','Gian hàng minh họa số 16','16 Đường Minh Họa, TP. Hồ Chí Minh',10.7016000,106.6016000,1,'Ngân hàng demo 6','100000000016','NGUOI DUNG 000016','/demo/qr/000016.png','ACTIVE'),(17,17,'Gian hàng đồ cũ 000017','Gian hàng minh họa số 17','17 Đường Minh Họa, TP. Hồ Chí Minh',10.7017000,106.6017000,1,'Ngân hàng demo 7','100000000017','NGUOI DUNG 000017','/demo/qr/000017.png','ACTIVE'),(18,18,'Gian hàng đồ cũ 000018','Gian hàng minh họa số 18','18 Đường Minh Họa, TP. Hồ Chí Minh',10.7018000,106.6018000,1,'Ngân hàng demo 8','100000000018','NGUOI DUNG 000018','/demo/qr/000018.png','ACTIVE'),(19,19,'Gian hàng đồ cũ 000019','Gian hàng minh họa số 19','19 Đường Minh Họa, TP. Hồ Chí Minh',10.7019000,106.6019000,1,'Ngân hàng demo 9','100000000019','NGUOI DUNG 000019','/demo/qr/000019.png','ACTIVE'),(20,20,'Gian hàng đồ cũ 000020','Gian hàng minh họa số 20','20 Đường Minh Họa, TP. Hồ Chí Minh',10.7020000,106.6020000,1,'Ngân hàng demo 0','100000000020','NGUOI DUNG 000020','/demo/qr/000020.png','ACTIVE');
/*!40000 ALTER TABLE `Stores` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `SystemSettings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SystemSettings` (
  `SettingKey` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `SettingValue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `UpdatedBy` int unsigned DEFAULT NULL,
  `UpdatedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`SettingKey`),
  KEY `UpdatedBy` (`UpdatedBy`),
  CONSTRAINT `SystemSettings_ibfk_1` FOREIGN KEY (`UpdatedBy`) REFERENCES `Users` (`UserId`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `SystemSettings` WRITE;
/*!40000 ALTER TABLE `SystemSettings` DISABLE KEYS */;
INSERT INTO `SystemSettings` VALUES ('COMMISSION_DUE_DAYS','7',NULL,NULL),('COMMISSION_RATE','5',NULL,NULL),('FEE_BANK_ACCOUNT_HOLDER','CHO DO CU',NULL,NULL),('FEE_BANK_ACCOUNT_NUMBER','0123456789',NULL,NULL),('FEE_BANK_CODE','970436',NULL,NULL),('REFUND_WINDOW_DAYS','7',NULL,NULL),('RESERVATION_HOURS','24',NULL,NULL),('SELLER_DEBT_LIMIT','5000000',NULL,NULL),('VIP_FEE','40000',NULL,NULL);
/*!40000 ALTER TABLE `SystemSettings` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `UserRoles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `UserRoles` (
  `UserId` int unsigned NOT NULL,
  `RoleId` int unsigned NOT NULL,
  `AssignedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`UserId`,`RoleId`),
  KEY `RoleId` (`RoleId`),
  CONSTRAINT `UserRoles_ibfk_1` FOREIGN KEY (`UserId`) REFERENCES `Users` (`UserId`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `UserRoles_ibfk_2` FOREIGN KEY (`RoleId`) REFERENCES `Roles` (`RoleId`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `UserRoles` WRITE;
/*!40000 ALTER TABLE `UserRoles` DISABLE KEYS */;
INSERT INTO `UserRoles` VALUES (1,1,'2026-01-02 00:00:00'),(2,2,'2026-01-03 00:00:00'),(3,3,'2026-01-04 00:00:00'),(4,4,'2026-01-05 00:00:00'),(5,5,'2026-01-06 00:00:00'),(6,6,'2026-01-07 00:00:00'),(7,7,'2026-01-08 00:00:00'),(8,8,'2026-01-09 00:00:00'),(9,9,'2026-01-10 00:00:00'),(10,10,'2026-01-11 00:00:00'),(11,11,'2026-01-12 00:00:00'),(12,12,'2026-01-13 00:00:00'),(13,13,'2026-01-14 00:00:00'),(14,14,'2026-01-15 00:00:00'),(15,15,'2026-01-16 00:00:00'),(16,16,'2026-01-17 00:00:00'),(17,17,'2026-01-18 00:00:00'),(18,18,'2026-01-19 00:00:00'),(19,19,'2026-01-20 00:00:00'),(20,20,'2026-01-21 00:00:00');
/*!40000 ALTER TABLE `UserRoles` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `Users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Users` (
  `UserId` int unsigned NOT NULL AUTO_INCREMENT,
  `Username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `PasswordHash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `FullName` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Email` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Phone` varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `GoogleId` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `AvatarUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `EmailVerified` tinyint(1) NOT NULL DEFAULT '0',
  `PhoneVerified` tinyint(1) NOT NULL DEFAULT '0',
  `Status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`UserId`),
  UNIQUE KEY `Username` (`Username`),
  UNIQUE KEY `Email` (`Email`),
  UNIQUE KEY `Phone` (`Phone`),
  UNIQUE KEY `GoogleId` (`GoogleId`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `Users` WRITE;
/*!40000 ALTER TABLE `Users` DISABLE KEYS */;
INSERT INTO `Users` VALUES (1,'user_000001','demo_hash_not_for_production','Người dùng 000001','user_000001@example.local','0900000001',NULL,'/demo/avatars/1.png','Địa chỉ minh họa số 1, Việt Nam',1,1,'ACTIVE','2026-01-02 00:00:00','2026-01-03 00:00:00'),(2,'user_000002','demo_hash_not_for_production','Người dùng 000002','user_000002@example.local','0900000002',NULL,'/demo/avatars/2.png','Địa chỉ minh họa số 2, Việt Nam',1,1,'ACTIVE','2026-01-03 00:00:00','2026-01-04 00:00:00'),(3,'user_000003','demo_hash_not_for_production','Người dùng 000003','user_000003@example.local','0900000003',NULL,'/demo/avatars/3.png','Địa chỉ minh họa số 3, Việt Nam',0,1,'ACTIVE','2026-01-04 00:00:00','2026-01-05 00:00:00'),(4,'user_000004','demo_hash_not_for_production','Người dùng 000004','user_000004@example.local','0900000004',NULL,'/demo/avatars/4.png','Địa chỉ minh họa số 4, Việt Nam',1,1,'ACTIVE','2026-01-05 00:00:00','2026-10-02 06:54:39'),(5,'user_000005','demo_hash_not_for_production','Người dùng 000005','user_000005@example.local','0900000005',NULL,'/demo/avatars/5.png','Địa chỉ minh họa số 5, Việt Nam',1,1,'ACTIVE','2026-01-06 00:00:00','2026-01-07 00:00:00'),(6,'user_000006','demo_hash_not_for_production','Người dùng 000006','user_000006@example.local','0900000006',NULL,'/demo/avatars/6.png','Địa chỉ minh họa số 6, Việt Nam',0,1,'ACTIVE','2026-01-07 00:00:00','2026-01-08 00:00:00'),(7,'user_000007','demo_hash_not_for_production','Người dùng 000007','user_000007@example.local','0900000007',NULL,'/demo/avatars/7.png','Địa chỉ minh họa số 7, Việt Nam',1,1,'ACTIVE','2026-01-08 00:00:00','2026-01-09 00:00:00'),(8,'user_000008','demo_hash_not_for_production','Người dùng 000008','user_000008@example.local','0900000008',NULL,'/demo/avatars/8.png','Địa chỉ minh họa số 8, Việt Nam',1,1,'ACTIVE','2026-01-09 00:00:00','2026-10-02 06:54:39'),(9,'user_000009','demo_hash_not_for_production','Người dùng 000009','user_000009@example.local','0900000009',NULL,'/demo/avatars/9.png','Địa chỉ minh họa số 9, Việt Nam',0,1,'ACTIVE','2026-01-10 00:00:00','2026-01-11 00:00:00'),(10,'user_000010','demo_hash_not_for_production','Người dùng 000010','user_000010@example.local','0900000010',NULL,'/demo/avatars/10.png','Địa chỉ minh họa số 10, Việt Nam',1,1,'ACTIVE','2026-01-11 00:00:00','2026-01-12 00:00:00'),(11,'user_000011','demo_hash_not_for_production','Người dùng 000011','user_000011@example.local','0900000011',NULL,'/demo/avatars/11.png','Địa chỉ minh họa số 11, Việt Nam',1,1,'ACTIVE','2026-01-12 00:00:00','2026-01-13 00:00:00'),(12,'user_000012','demo_hash_not_for_production','Người dùng 000012','user_000012@example.local','0900000012',NULL,'/demo/avatars/12.png','Địa chỉ minh họa số 12, Việt Nam',0,0,'ACTIVE','2026-01-13 00:00:00','2026-01-14 00:00:00'),(13,'user_000013','demo_hash_not_for_production','Người dùng 000013','user_000013@example.local','0900000013',NULL,'/demo/avatars/13.png','Địa chỉ minh họa số 13, Việt Nam',1,1,'ACTIVE','2026-01-14 00:00:00','2026-01-15 00:00:00'),(14,'user_000014','demo_hash_not_for_production','Người dùng 000014','user_000014@example.local','0900000014',NULL,'/demo/avatars/14.png','Địa chỉ minh họa số 14, Việt Nam',1,1,'ACTIVE','2026-01-15 00:00:00','2026-01-16 00:00:00'),(15,'user_000015','demo_hash_not_for_production','Người dùng 000015','user_000015@example.local','0900000015',NULL,'/demo/avatars/15.png','Địa chỉ minh họa số 15, Việt Nam',0,1,'ACTIVE','2026-01-16 00:00:00','2026-01-17 00:00:00'),(16,'user_000016','demo_hash_not_for_production','Người dùng 000016','user_000016@example.local','0900000016',NULL,'/demo/avatars/16.png','Địa chỉ minh họa số 16, Việt Nam',1,0,'ACTIVE','2026-01-17 00:00:00','2026-01-18 00:00:00'),(17,'user_000017','demo_hash_not_for_production','Người dùng 000017','user_000017@example.local','0900000017',NULL,'/demo/avatars/17.png','Địa chỉ minh họa số 17, Việt Nam',1,1,'ACTIVE','2026-01-18 00:00:00','2026-01-19 00:00:00'),(18,'user_000018','demo_hash_not_for_production','Người dùng 000018','user_000018@example.local','0900000018',NULL,'/demo/avatars/18.png','Địa chỉ minh họa số 18, Việt Nam',0,1,'ACTIVE','2026-01-19 00:00:00','2026-01-20 00:00:00'),(19,'user_000019','demo_hash_not_for_production','Người dùng 000019','user_000019@example.local','0900000019',NULL,'/demo/avatars/19.png','Địa chỉ minh họa số 19, Việt Nam',1,1,'ACTIVE','2026-01-20 00:00:00','2026-01-21 00:00:00'),(20,'user_000020','demo_hash_not_for_production','Người dùng 000020','user_000020@example.local','0900000020',NULL,'/demo/avatars/0.png','Địa chỉ minh họa số 20, Việt Nam',1,0,'ACTIVE','2026-01-21 00:00:00','2026-01-22 00:00:00');
/*!40000 ALTER TABLE `Users` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `VerificationCodes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `VerificationCodes` (
  `VerificationId` int unsigned NOT NULL AUTO_INCREMENT,
  `UserId` int unsigned DEFAULT NULL,
  `Recipient` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Channel` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Purpose` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `CodeHash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ExpiresAt` datetime NOT NULL,
  `UsedAt` datetime DEFAULT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`VerificationId`),
  KEY `UserId` (`UserId`),
  KEY `verification_codes__recipient__purpose` (`Recipient`,`Purpose`),
  CONSTRAINT `VerificationCodes_ibfk_1` FOREIGN KEY (`UserId`) REFERENCES `Users` (`UserId`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `VerificationCodes` WRITE;
/*!40000 ALTER TABLE `VerificationCodes` DISABLE KEYS */;
INSERT INTO `VerificationCodes` VALUES (1,1,'user_000001@example.local','SMS','VERIFY_PHONE','hashed_demo_code_000001','2026-01-03 00:00:00',NULL,'2026-01-02 00:00:00'),(2,2,'user_000002@example.local','EMAIL','RESET_PASSWORD','hashed_demo_code_000002','2026-01-04 00:00:00','2026-01-03 00:00:00','2026-01-03 00:00:00'),(3,3,'user_000003@example.local','SMS','REGISTER','hashed_demo_code_000003','2026-01-05 00:00:00',NULL,'2026-01-04 00:00:00'),(4,4,'user_000004@example.local','EMAIL','VERIFY_PHONE','hashed_demo_code_000004','2026-01-06 00:00:00','2026-01-05 00:00:00','2026-01-05 00:00:00'),(5,5,'user_000005@example.local','SMS','RESET_PASSWORD','hashed_demo_code_000005','2026-01-07 00:00:00',NULL,'2026-01-06 00:00:00'),(6,6,'user_000006@example.local','EMAIL','REGISTER','hashed_demo_code_000006','2026-01-08 00:00:00','2026-01-07 00:00:00','2026-01-07 00:00:00'),(7,7,'user_000007@example.local','SMS','VERIFY_PHONE','hashed_demo_code_000007','2026-01-09 00:00:00',NULL,'2026-01-08 00:00:00'),(8,8,'user_000008@example.local','EMAIL','RESET_PASSWORD','hashed_demo_code_000008','2026-01-10 00:00:00','2026-01-09 00:00:00','2026-01-09 00:00:00'),(9,9,'user_000009@example.local','SMS','REGISTER','hashed_demo_code_000009','2026-01-11 00:00:00',NULL,'2026-01-10 00:00:00'),(10,10,'user_000010@example.local','EMAIL','VERIFY_PHONE','hashed_demo_code_000010','2026-01-12 00:00:00','2026-01-11 00:00:00','2026-01-11 00:00:00'),(11,11,'user_000011@example.local','SMS','RESET_PASSWORD','hashed_demo_code_000011','2026-01-13 00:00:00',NULL,'2026-01-12 00:00:00'),(12,12,'user_000012@example.local','EMAIL','REGISTER','hashed_demo_code_000012','2026-01-14 00:00:00','2026-01-13 00:00:00','2026-01-13 00:00:00'),(13,13,'user_000013@example.local','SMS','VERIFY_PHONE','hashed_demo_code_000013','2026-01-15 00:00:00',NULL,'2026-01-14 00:00:00'),(14,14,'user_000014@example.local','EMAIL','RESET_PASSWORD','hashed_demo_code_000014','2026-01-16 00:00:00','2026-01-15 00:00:00','2026-01-15 00:00:00'),(15,15,'user_000015@example.local','SMS','REGISTER','hashed_demo_code_000015','2026-01-17 00:00:00',NULL,'2026-01-16 00:00:00'),(16,16,'user_000016@example.local','EMAIL','VERIFY_PHONE','hashed_demo_code_000016','2026-01-18 00:00:00','2026-01-17 00:00:00','2026-01-17 00:00:00'),(17,17,'user_000017@example.local','SMS','RESET_PASSWORD','hashed_demo_code_000017','2026-01-19 00:00:00',NULL,'2026-01-18 00:00:00'),(18,18,'user_000018@example.local','EMAIL','REGISTER','hashed_demo_code_000018','2026-01-20 00:00:00','2026-01-19 00:00:00','2026-01-19 00:00:00'),(19,19,'user_000019@example.local','SMS','VERIFY_PHONE','hashed_demo_code_000019','2026-01-21 00:00:00',NULL,'2026-01-20 00:00:00'),(20,20,'user_000020@example.local','EMAIL','RESET_PASSWORD','hashed_demo_code_000020','2026-01-22 00:00:00','2026-01-21 00:00:00','2026-01-21 00:00:00');
/*!40000 ALTER TABLE `VerificationCodes` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

