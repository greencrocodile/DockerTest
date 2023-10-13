const winston = require(`winston`);
const fs = require('fs');

require(`winston-daily-rotate-file`);

class Logger {

    constructor(config) {
        this.config = config;
        
        if (!fs.existsSync(this.config.info_path)) {
            fs.mkdirSync(this.config.info_path);
        }

        if (!fs.existsSync(this.config.error_path)) {
            fs.mkdirSync(this.config.error_path);
        }

    }

    init() {
        let format = winston.format.combine(
            winston.format.simple()
        );

        let infoDatePattern = `YYYY-MM-DD`;

        switch (this.config.info_period) {
            case `day`: {
                infoDatePattern = `YYYY-MM-DD`;
                break;
            }
            case `hour`: {
                infoDatePattern = `YYYY-MM-DD-HH`;
                break;
            }
            case `minute`: {
                infoDatePattern = `YYYY-MM-DD-HH-mm`;
                break;
            }
            default: {
                break;
            }
        }

        let errorDatePattern = `YYYY-MM-DD`;

        switch (this.config.error_period) {
            case `day`: {
                errorDatePattern = `YYYY-MM-DD`;
                break;
            }
            case `hour`: {
                errorDatePattern = `YYYY-MM-DD-HH`;
                break;
            }
            case `minute`: {
                errorDatePattern = `YYYY-MM-DD-HH-mm`;
                break;
            }
            default: {
                break;
            }
        }

        winston.configure({
            transports: [
                new winston.transports.DailyRotateFile({
                    name: `info-file`,
                    filename: `${this.config.info_path}/info-%DATE%.log`,
                    datePattern: infoDatePattern,
                    level: `info`,
                    maxFiles: this.config.info_max_files === 0 ? null : this.config.info_max_files,
                    format
                }),
                new winston.transports.DailyRotateFile({
                    name: `error-file`,
                    filename: `${this.config.error_path}/error-%DATE%.log`,
                    datePattern: errorDatePattern,
                    level: `error`,
                    maxFiles: this.config.error_max_files === 0 ? null : this.config.error_max_files,
                    format
                })
            ]
        });
    }

    getCurrentISODate() {
        let dt = new Date();

        dt = new Date(dt - dt.getTimezoneOffset() * 60000);

        return dt.toISOString();
    }

    log(msg) {
        if (this.config.console) {
            console.log(`${this.getCurrentISODate()} ${msg}`);
        }
        if (this.config.file) {
            winston.log(`info`, `${this.getCurrentISODate()} ${msg}`);
        }
    }

    error(msg) {
        if (this.config.console) {
            console.log(`${this.getCurrentISODate()} ${msg}`);
        }
        if (this.config.file) {
            winston.log(`error`, `${this.getCurrentISODate()} ${msg}`);
        }
    }
}

module.exports = Logger;
