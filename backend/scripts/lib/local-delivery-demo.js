'use strict';
const bcrypt = require('bcrypt');
const { verifyLocalDatabase } = require('./local-db-guard');
const AREA = 'TP. Hồ Chí Minh';
const MARKER = 'WEB1_LOCAL_DELIVERY_DEMO_V1';
async function ensureLocalDeliveryDemo(db) {
  const identity=await verifyLocalDatabase(db,{allowTest:true});
  const password=process.env.LOCAL_DEMO_PASSWORD;
  if(typeof password!=='string'||password.length<12)throw new Error('Set LOCAL_DEMO_PASSWORD (at least12 characters); existing passwords are never reset');
  const m=require('../../src/models');
  const result={database:identity.db,area:AREA,vehicleType:'MOTORBIKE',created:{},accounts:{},listings:[]};
  const lock='local-demo:'+identity.db;
  await db.transaction(async transaction=>{
    const [[acquired]]=await db.query('SELECT GET_LOCK(?,10) locked',{replacements:[lock],transaction});
    if(Number(acquired.locked)!==1)throw new Error('Demo loader is already running');
    try {
      const once=async(model,where,defaults)=>{
        const [row,created]=await model.findOrCreate({where,defaults,transaction});
        if(created)result.created[model.tableName]=(result.created[model.tableName]||0)+1;
        return row;
      };
      for(const [kind,roleName,fullName,phone] of [['buyer','USER','Người mua demo local','0909000101'],['seller','SELLER','Người bán demo local','0909000102'],['driver','DRIVER','Tài xế demo local','0909000103']]) {
        const email=kind+'@demo.web1.test',username='local_demo_'+kind;
        let user=await m.Users.findOne({where:{Email:email},transaction});
        if(user&&(user.Username!==username||user.FullName!==fullName))throw new Error('Reserved demo email belongs to another account; retained: '+email);
        if(!user)user=await once(m.Users,{Email:email},{Username:username,FullName:fullName,PasswordHash:await bcrypt.hash(password,10),Phone:phone,EmailVerified:true,PhoneVerified:true,Status:'ACTIVE',Address:AREA});
        result.accounts[kind]={id:user.UserId,email};
        for(const rn of new Set(['USER',roleName])){
          const role=await once(m.Roles,{RoleName:rn},{Description:'Vai trò '+rn});
          await once(m.UserRoles,{UserId:user.UserId,RoleId:role.RoleId},{});
        }
        if(kind!=='buyer')await once(m.PartnerApplications,{UserId:user.UserId,PartnerType:roleName},{Status:'APPROVED',ReviewNote:MARKER+' — hồ sơ mẫu local đã duyệt',ReviewedAt:new Date()});
      }
      const store=await once(m.Store,{OwnerId:result.accounts.seller.id},{StoreName:'Gian hàng đồ cũ demo local',Description:MARKER,Address:'10 Nguyễn Huệ, TP. Hồ Chí Minh (địa chỉ minh họa)',PickupArea:AREA,Latitude:'10.7730000',Longitude:'106.7040000',IsDemoLocation:true,Status:'ACTIVE',BankName:'BIDV',BankAccountNumber:'000000000102',BankAccountHolder:'NGUOI BAN DEMO LOCAL'});
      result.storeId=store.StoreId;
      await once(m.DriverProfiles,{UserId:result.accounts.driver.id},{VehicleType:'MOTORBIKE',VehiclePlate:'DEMO-LOCAL-01',ServiceArea:AREA,MaxDistanceKm:null,AvailabilityStatus:'AVAILABLE',BankName:'BIDV',BankAccountNumber:'000000000103',BankAccountHolder:'TAI XE DEMO LOCAL',UpdatedAt:new Date()});
      // D12 currently has no measured route distance. An unrestricted demo radius
      // uses the existing policy; never manufacture kilometers or remove a check.
      const rule=await once(m.DeliveryFeeRules,{PickupArea:AREA,DeliveryArea:AREA,VehicleType:'MOTORBIKE'},{FeeAmount:'25000.00',EstimatedMinutes:45,Status:'ACTIVE'});
      if(rule.Status!=='ACTIVE')throw new Error('Demo route was disabled; loader will not override it');
      result.ruleId=rule.RuleId;
      for(const [name,title,price] of [['Máy tính và điện thoại','Laptop Dell Latitude dùng học tập — demo local','1500000.00'],['Nội thất gia đình','Ghế làm việc nhỏ gọn — demo local','350000.00'],['Sách và học tập','Bộ sách nhập môn lập trình — demo local','120000.00']]){
        const category=await once(m.Categories,{CategoryName:name,Description:MARKER},{Status:'ACTIVE'});
        const listing=await once(m.Listings,{SellerId:result.accounts.seller.id,Title:title},{StoreId:store.StoreId,CategoryId:category.CategoryId,Description:'Sản phẩm mẫu để thử luồng mua bán local. Không chuyển tiền thật. '+MARKER,Price:price,ConditionLevel:'GOOD',Location:AREA,Status:'ACTIVE'});
        await once(m.ListingMedia,{ListingId:listing.ListingId,MediaType:'IMAGE',SortOrder:1},{MediaUrl:'/demo/local-delivery.svg'});
        result.listings.push({id:listing.ListingId,title,status:listing.Status});
      }
    } finally {await db.query('SELECT RELEASE_LOCK(?)',{replacements:[lock],transaction});}
  });
  return result;
}
module.exports={ensureLocalDeliveryDemo,AREA,MARKER};
