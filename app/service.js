/*
#8175
сервис обновления плановых дат подключения для отключений, полученных от АС УЕДС
*/

const fs = require('fs');
const Logger = require('./Logger');
const AutoCloseService = require('./AutoCloseService');

let config;

try {
    config = JSON.parse(fs.readFileSync(`./config.json`).toString('utf8'));
} catch (e) {
    console.log(`ошибка чтения конфигурационного файла`);
    console.log(e);
    throw e;
}

let logger;

try {
    logger = new Logger(config.log); 

    logger.init();

} catch (e) {
    console.log(`ошибка регистрации логгера`);
    console.log(e);
}

let autoCloseService = new AutoCloseService(config.options, logger);

autoCloseService.run();
