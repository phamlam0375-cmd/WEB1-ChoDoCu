'use strict';
// Opt-in additive data: works after both snapshot import and migration/seed setup.
module.exports={
  async up(queryInterface){
    if(process.env.LOCAL_DEMO_DATA!=='true')return;
    await require('../scripts/lib/local-delivery-demo').ensureLocalDeliveryDemo(queryInterface.sequelize);
  },
  async down(){
    if(process.env.LOCAL_DEMO_DATA!=='true')return;
    throw new Error('Local demo data can have real user interactions; no bulk undo is provided.');
  },
};
