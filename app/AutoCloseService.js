const MDMExchange = require('@fortus/mdmexchange/MDMExchange');
const lodash = require('lodash');
// const uuid = require('uuid');
const attributesMap = [
    { attributeId: `ВремяЗакрытияОтключенияВЧасах`, attrField: 'Value', objField: 'hours', type: 'string' },
    { attributeId: `ОтноситсяККлассу`, attrField: 'Value', objField: 'classRelated', type: 'string' },
    { attributeId: `ДатаИВремяОтключенияПотребителей`, attrField: 'Value', objField: 'disconDate', type: 'string' }
];

class AutoCloseService {
    constructor(config, logger){
        this.config = config;
        this.logger = logger;
        this.mdmExchange = new MDMExchange({ url: this.config.mdm_addr }, this.logger);
    }

    async loadDictionaries(){
        try {
            this.hoursDictionary = { 
                name: '', 
                data: this.mdmExchange.processObject(
                    await this.mdmExchange.getFromMdm(
                        { 
                            className: `СрокЗакрытияОтключения`, 
                            fieldSet: [
                                {
                                    'Exclude': "0",
                                    'Field': [
                                        {
                                            'AttributeId': 'ВремяЗакрытияОтключенияВЧасах'
                                        }, {
                                            'AttributeId': 'ОтноситсяККлассу'
                                        }
                                    ]
                                }
                            ]
                        }
                    ), 
                    attributesMap
                ) 
            };
        } catch (err) {
            this.logger.error(err);
        }

    }

    async process(){
        clearTimeout(this.timeout);

        try {
            // 1.Запросить все не удаленные объекты класса СрокЗакрытияОтключения и сохранить в локальном кэше.
            // Добавить ограничение набора атрибутов в ответе: ВремяЗакрытияОтключенияВЧасах и ОтноситсяККлассу.

            await this.loadDictionaries();

            let dateFrom = new Date(this.config.first_date);
            let dateTill = new Date(this.config.second_date);

            this.logger.log(dateFrom, dateTill);

            if (dateFrom>=dateTill) {
                this.logger.error(`Начальная дата ${this.config.first_date} должна быть меньше конечной даты ${this.config.second_date}`);
            } else {
                let currentDateFrom = dateFrom;
                let currentDateTill;
                let tzoffset = (new Date()).getTimezoneOffset() * 60000;
                while (true) {

                    currentDateTill = new Date(currentDateFrom);
                    currentDateTill.setDate(currentDateFrom.getDate() + 1);

                    if (currentDateTill > dateTill){
                        currentDateTill = dateTill;
                    }

                    // 2.Запросить объекты классов ПричинаОтключение и АрхивноеСообщение (архивная БД) по условию:
                    // archive = false
                    // ПлановыйСрокИсполнения = NotExists
                    // ДатаЗакрытияОбращения = NotExists
                    // ДатаИВремяФактическогоУстраненияДефекта = NotExists
                    // ДатаИВремяОтключенияПотребителей >= значение переменной firstDate
                    // ДатаИВремяОтключенияПотребителей <= значение переменной secondDate
                    // добавить сортировку ASC по атрибуту ДатаИВремяОтключенияПотребителей.

                    let res = await this.mdmExchange.getFromMdm(
                        {
                            className: [
                                {"Code":"ПричинаОтключение"},
                                {"Code":"АрхивноеСообщение"}
                            ], 
                            filters: [
                                {
                                    'Operation': 'And',
                                    'Filter': [
                                        { 'Attribute': 'http://trinidata.ru/archigraph-mdm/archive', 'Value': 'false', 'Comparison': 'Equal' },
                                        { 'Attribute': 'ПлановыйСрокИсполнения', 'Comparison': 'NotExists' },
                                        { 'Attribute': 'ДатаЗакрытияОбращения', 'Comparison': 'NotExists' },
                                        { 'Attribute': 'ДатаИВремяФактическогоУстраненияДефекта ', 'Comparison': 'NotExists' },
                                        { 'Attribute': 'ДатаИВремяОтключенияПотребителей ', 'Value': `${new Date(currentDateFrom - tzoffset).toISOString().substring(0,19)}`, 'Comparison': 'MoreOrEqual' },
                                        { 'Attribute': 'ДатаИВремяОтключенияПотребителей ', 'Value': `${new Date(currentDateTill - tzoffset).toISOString().substring(0,19)}`, 'Comparison': 'LessOrEqual' }
            
                                    ]
                                }
                            ], 
                            sorting: [ 
                                { 
                                    'AttributeId': 'ДатаИВремяОтключенияПотребителей', 
                                    'Direction': 'ASC',
                                    'SortByName': 0
                                }
                            ],
                            ObjectTypeGroupOperation:"and",
                            CombineGroups: "and"
                        }
                    );

                    for(let discon of res){
                        let hours;
                        let disconDate;
                        for (let type of discon.Type){
                            
                            if (type.TypeId.substring(0,5) === 'АпкБг'){
                                // 3.Найти соответствие в справочнике из п.1. по условию: ОтноситсяККлассу = TypeId классификатора АПК БГ из п.2.
                                // Извлечь из ответа значение атрибута ВремяЗакрытияОтключенияВЧасах.
                                [hours] = lodash.filter(this.hoursDictionary.data, { classRelated: type.TypeId });
                                break;
                            }
                        }

                        for(let attr of discon.Attribute){
                            if (attr.AttributeId === 'ДатаИВремяОтключенияПотребителей'){
                                disconDate = new Date(attr.Value);
                                break;
                            }
                        }

                        // 4.Вычислить значение даты планового срока исполнения.
                        // Для каждого объекта из п.2. к значению атрибута ДатаИВремяОтключенияПотребителей прибавить значение атрибута ВремяЗакрытияОтключенияВЧасах из п.3.
                        disconDate.setTime(disconDate.getTime() + (hours.hours*60*60*1000));

                        // 5.Обновить объект отключения и объекты, связанные с отключением (архивная БД).
                        // 5.1.Обновить объект отключения.
                        // await this.mdmExchange.updateEntity(
                        //     discon.Code, 
                        //     'АрхивноеСообщение', 
                        //     {"ПлановыйСрокИсполнения": disconDate.toISOString().substring(0, 19)}, 
                        //     {}
                        // );

                        // 5.2.Обновить объекты, связанные с отключением.
                        // 5.2.1.Запросить объекты, связанные с отключением (объекты класса АрхивныеОбъектыСвязанныеСОтключением) по условию:

                        let referenceObjects = await this.mdmExchange.getFromMdm(
                            {
                                className: 'АрхивныеОбъектыСвязанныеСОтключением', 
                                filters: [
                                    {
                                        'Operation': 'And',
                                        'Filter': [
                                            { 'Attribute': 'http://trinidata.ru/archigraph-mdm/archive', 'Value': 'false', 'Comparison': 'Equal' },
                                            { 'Attribute': 'ОтноситсяКДефекту', 'Value':discon.Code, 'Comparison': 'Equal' },         
                                        ]
                                    }
                                ]
                            }
                        );

                        for(let ref of referenceObjects){
                            // 5.2.2.Обновить найденные объекты, связанные с отключением.
                            // await this.mdmExchange.updateEntity(
                            //     ref.Code, 
                            //     ref.Type[0].TypeId, 
                            //     {"ПлановыйСрокИсполнения": disconDate.toISOString().substring(0, 19)}, 
                            //     {}
                            // );
                        }
                    }
                    if (currentDateTill === dateTill){
                        break;
                    }
                    currentDateFrom = currentDateTill;
                }
            }
        } catch(e) {
           this.logger.error(e);
        }
        this.timeout = setTimeout(await this.process.bind(this), 10000);
    }

    async run() {
        this.logger.log('Service started');
        await this.process();
    }
}

module.exports = AutoCloseService;
