Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    weeks : [],
    numberOfWeeks : 24,
    arrOfCreationDateFilters : [],
    arrOfFixedAndLimitedByCreationDateFilters : [],
    created : [],
    fixedWithinTTR : [],
    ttr1  : 28, //28 days = 4 weeks
    ttr2  : 84,
    //defectDetails:[],
    allData : [],
    categories : [],
    launch: function() {
        this._myMask = new Ext.LoadMask(Ext.getBody(), {msg:"Please wait.This may take long..."});
        this._myMask.show();
        this.getDates();
        this.createFilters();
        this.makeStore();
        this.defectDetails = new Array(this.numberOfWeeks);
        for (var i = 0; i < this.numberOfWeeks; i++) {
            this.defectDetails[i] = [];
        }
        var gridPanel = Ext.create('Ext.Panel', {
            //title: 'Grid Panel',                          
            itemId:'gridPanel',
            layout: {
                type: 'hbox',
                align: 'stretch'
            },
            items: [{
                xtype: 'panel',
                title: '4 week and 12 week DRI. Click on a row to see details',
                itemId:'childPanel1',
                flex: 1
            },{
                xtype: 'panel',
                title: 'Last Week or Selected Week Defects',
                itemId:'childPanel2',
                flex: 2
            }]
        });
        var chartPanel = Ext.create('Ext.Panel', {
            title: 'DRI Chart',
            itemId: 'chartPanel'
        });
        
        this.add(gridPanel);
        this.add(chartPanel);
        
    },
    getDates:function(){
        var now = new Date(),
            today = now.getDay(),
            saturday = 6,
            //ttr = 4,
            padding = 1,
            howFarBack = this.numberOfWeeks + padding,
            saturdayDates = [],
            closestSaturday = null,
            prevSaturday = null,
            weeks = [];
        var daysFromLastSaturday = today - saturday;
        closestPastSaturday = new Date(now - daysFromLastSaturday*86400000 - 7*86400000);
        saturdayDates.push(Rally.util.DateTime.format(closestPastSaturday, 'Y-m-d'));
        //console.log('today:', today, 'daysFromLastSaturday:',daysFromLastSaturday, 'closestPastSaturday:',closestPastSaturday);
        for(var i=1;i<howFarBack;i++){
            var prevSaturday = new Date(closestPastSaturday - 7*86400000);
            saturdayDates.push(Rally.util.DateTime.format(prevSaturday, 'Y-m-d'));
            closestPastSaturday = prevSaturday;
             
        }
        //console.log('saturdayDates:',saturdayDates);
        
        for (var i=0; i<saturdayDates.length-1; i++) {
            var week = {};
            week['end'] = saturdayDates[i];
            week['start'] = saturdayDates[i+1];
            this.weeks.push(week);
        }
    },
    createFilters:function(){
        var tagFilter;
        var codeResolitionFilter;
        var closedFilter;
        var fixedFilter;
        var closedDateFilters = [];
        var creationDateFilters = [];
        
        tagFilter = Ext.create('Rally.data.wsapi.Filter', {
             property : 'Tags.Name',
             operator: 'contains',
             value: 'Customer Voice'
        });
        
        closedFilter = tagFilter.and(Ext.create('Rally.data.wsapi.Filter', {
            property : 'State',
	    value: 'Closed'
        }));
        
        codeResolitionFilter = Rally.data.wsapi.Filter.or([
            {
		property : 'Resolution',
		value : 'Code Change'
	    },
	    {
		property : 'Resolution',
		value : 'Database/Metadata Change'
	    },
	    {
		property : 'Resolution',
		value: 'Configuration Change'
	    }
        ]);
        
        fixedFilter = closedFilter.and(codeResolitionFilter);
        
        _.each(this.weeks, function(week){
            var creationDateFilter = Rally.data.wsapi.Filter.and([
                {
                    property : 'CreationDate',
                    operator : '>=',
                    value : week['start']
                },
                {
                    property : 'CreationDate',
                    operator : '<',
                    value : week['end']
                }
            ]);
            this.arrOfCreationDateFilters.push(tagFilter.and(creationDateFilter));
            this.arrOfFixedAndLimitedByCreationDateFilters.push(fixedFilter.and(creationDateFilter));
        },this);
        
        console.log(this.arrOfCreationDateFilters.length, ' Creation Date Filters--------');
        _.each(this.arrOfCreationDateFilters, function(filter){
            console.log(filter.toString());
        },this);
        console.log(this.arrOfFixedAndLimitedByCreationDateFilters.length, ' Fixed Filters limited by Creation Dates-----------');
        _.each(this.arrOfFixedAndLimitedByCreationDateFilters, function(filter){
            console.log(filter.toString());
        },this);
    },
    
    makeStore:function(){
        this.concatArraysOfFilters = this.arrOfCreationDateFilters.concat(
            this.arrOfFixedAndLimitedByCreationDateFilters); //turn into one array of 24 filters
        this.defectStore = Ext.create('Rally.data.wsapi.Store',{
            model: 'Defect',
            fetch: ['Name','State','Resolution','FormattedID','CreationDate','ClosedDate','Owner','Project','Priority'],
            limit: Infinity
        });
        this.applyFiltersToStore(0);
    },
    
    applyFiltersToStore:function(i){
        this.defectStore.addFilter(this.concatArraysOfFilters[i]);
        this.defectStore.load({
            scope: this,
            callback: function(records, operation) {
                if(operation.wasSuccessful()) {
                    //console.log('records.length',records.length);
                    if (i<this.numberOfWeeks) { //first $numberOfWeeks are creation date filters,include open & closed bugs
                        this.created.push(records.length);
                        _.each(records, function(record){
                            var owner = record.get('Owner');
                            //var closedDate = record.get('ClosedDate');
                            this.defectDetails[i].push({
                            '_ref':record.get('_ref'),   
                            'FormattedID':record.get('FormattedID'),
                            'Name':record.get('Name'),
                            'State': record.get('State'),
                            'Resolution': record.get('Resolution'),
                            'Priority': record.get('Priority'),
                            'Owner': (owner && owner._refObjectName) || 'None',
                            'Project':record.get('Project')._refObjectName,
                            'CreationDate': Rally.util.DateTime.format(record.get('CreationDate'), 'Y-m-d'),
                            'ClosedDate': Rally.util.DateTime.format(record.get('ClosedDate'), 'Y-m-d')
                        });
                        },this);
                    }
                    else{
                        this.fixedWithinTTR.push(this.getFixedDefectsWithinTTR(records));
                        //console.log('inside loop this.fixedWithinTTR:', this.fixedWithinTTR);
                    }
                    this.defectStore.clearFilter(records.length);
                    if (i < this.concatArraysOfFilters.length-1) { //if not done, call itself
                        this.applyFiltersToStore(i + 1);
                    }
                    else{
                        this.makeCustomStore();
                    }
                }
            }
        });
    },
    getFixedDefectsWithinTTR:function(records){
        var closedDefectsWithinTTR1 = [],
            closedDefectsWithinTTR2 = [],
            closedDefectsWithinAllTTRs = [];
        var arrayOfDataObjects = [];
        _.each(records, function(record){
            var created = new Date(record.get('CreationDate'));
            var closed = new Date(record.get('ClosedDate'));
            //console.log(record.get('FormattedID'));
            //console.log('created',created);
            //console.log('closed',closed);
            var diff = Math.floor((closed - created)/86400000); 
            //console.log('diff', diff);
            if (diff <= this.ttr2) {
                closedDefectsWithinTTR2.push(record);
            }
            if (diff <= this.ttr1) {
                closedDefectsWithinTTR1.push(record);
            }
        },this);
        closedDefectsWithinAllTTRs.push(closedDefectsWithinTTR1.length);
        closedDefectsWithinAllTTRs.push(closedDefectsWithinTTR2.length);
        return closedDefectsWithinAllTTRs;
    },
    makeCustomStore:function(){
        //console.log('created',this.created);
        //console.log('fixedWithinTTR',this.fixedWithinTTR);
        this.fixedWithinTTR = _.flatten(this.fixedWithinTTR);
        var fixedWithinTTR1 = [];
        var fixedWithinTTR2 = [];
        for(var index=0; index<this.fixedWithinTTR.length;index++){
            if(index % 2 == 0){
                fixedWithinTTR1.push(this.fixedWithinTTR[index]);
            }
            else{
                fixedWithinTTR2.push(this.fixedWithinTTR[index]);
            }
        }
        var startDates = [];
        var endDates = [];
        var dri1 = [];
        var dri2 = [];
        
        var arrOfArraysOfColumnValues = [];      
        //console.log('fixedWithinTTR1',fixedWithinTTR1);
        //console.log('fixedWithinTTR2',fixedWithinTTR2);
        
        for(var f = 0, c=0; f<fixedWithinTTR1.length; f++,c++){
            dri1.push((fixedWithinTTR1[f]/this.created[c]*100).toFixed(2));
        }
        for(var f = 0, c=0; f<fixedWithinTTR2.length; f++,c++){
            dri2.push((fixedWithinTTR2[f]/this.created[c]*100).toFixed(2));
        }
        arrOfArraysOfColumnValues.push(this.created);
        arrOfArraysOfColumnValues.push(fixedWithinTTR1);
        arrOfArraysOfColumnValues.push(fixedWithinTTR2);
        arrOfArraysOfColumnValues.push(dri1);
        arrOfArraysOfColumnValues.push(dri2);
        arrOfArraysOfColumnValues.push(startDates);
        arrOfArraysOfColumnValues.push(endDates);
        _.each(this.weeks, function(week){
            startDates.push(week.start);
            endDates.push(week.end);
        });
        //console.log('arrOfArraysOfColumnValues',arrOfArraysOfColumnValues);
        //console.log('arrOfArraysOfColumnValues...');
        //_.each(arrOfArraysOfColumnValues, function(column){
        //    console.log(column);
        //});
        var arrOfArraysOfRowValues = _.zip(arrOfArraysOfColumnValues);
        //console.log('arrOfArraysOfRowValues',arrOfArraysOfRowValues);
        //console.log('arrOfArraysOfRowValues...');
        //_.each(arrOfArraysOfRowValues,function(row){
        //    console.log(row);
        //})
        var arrOfObjectsOfRowValues = [];
        for(var i = 0;i<arrOfArraysOfRowValues.length;i++){
            var o = {};
            for(var j=0; j<arrOfArraysOfRowValues[i].length;j++){
                o[j] = arrOfArraysOfRowValues[i][j];
            }
            arrOfObjectsOfRowValues.push(o);
        }
        
        //reverse arrOfObjectsOfRowValues for chart to match timeline
        for(var i = arrOfObjectsOfRowValues.length-1;i>=0;i--){
            this.allData.push(arrOfObjectsOfRowValues[i]);
        }
        
        //console.log('this.allData...');
        //_.each(this.allData, function(o){
        //    console.log(o);
        //},this);
        this.makeGrid(arrOfObjectsOfRowValues);
    },
    makeGrid:function(data){
        var that = this;
        this._myMask.hide();
        this.down('#childPanel1').add({
            xtype: 'rallygrid',
            itemId: 'defectGrid',
            store: Ext.create('Rally.data.custom.Store', {
                data: data
            }),
            listeners: {
                select: this.getDetails,
                load : function(selModel, record, index, options){
                    this.getDetails(selModel, record, 0, options);
                },
                scope: this
            },
            columnCfgs: [
                {
                    text: 'Start Week',
                    dataIndex: '5'
                },
                {
                    text: 'End Week',
                    dataIndex: '6'
                },
                {
                    text: 'Created Defects',
                    dataIndex: '0'
                },
                {
                    text: 'Fixed Defects (TTR <= 4 weeks)',
                    dataIndex: '1'
                },
                {
                    text: 'Fixed Defects (TTR <= 12 weeks)',
                    dataIndex: '2'
                },
                {
                    text: '4 Week DRI %',
                    dataIndex: '3'
                },
                {
                    text: '12 Week DRI %',
                    dataIndex: '4'
                }
            ],
            showPagingToolbar:false
        });
        this.prepareChart();
    },
    getDetails:function(selModel, record, rowIndex, options){
        //console.log('defectDetails[', rowIndex, ']', this.defectDetails[rowIndex]);
        
        //If we want to remove admin-closed defects use this:
        //var removeAdminClosedIfClosed = [];
        //_.each(this.defectDetails[rowIndex], function(obj){
        //    if (!obj.ClosedDate) {
        //        removeAdminClosedIfClosed.push(obj);
        //    }
        //    else {
        //        console.log('closed defect', obj.FormattedID);
        //        if ((obj.Resolution === "Code Change")||(obj.Resolution === "Database/Metadata Change")||(obj.Resolution === "Configuration Change")) {
        //            removeAdminClosedIfClosed.push(obj);
        //        }
        //    }
        //});
       
        var detailsGrid = this.down('#detailsGrid');
        if (detailsGrid) {
            Ext.ComponentQuery.query('#childPanel2')[0].remove(Ext.ComponentQuery.query('#detailsGrid')[0], true);
        }
        this.down('#childPanel2').add({
            xtype: 'rallygrid',
            itemId: 'detailsGrid',
            store: Ext.create('Rally.data.custom.Store', {
                //data: removeAdminClosedIfClosed
                data: this.defectDetails[rowIndex]
            }),
            columnCfgs: [
                {
                    text: 'FormattedID',
                    dataIndex: 'FormattedID', xtype:'templatecolumn',
                    tpl: Ext.create('Rally.ui.renderer.template.FormattedIDTemplate')
                },
                {
                    text: 'Name',
                    dataIndex: 'Name',
                    flex:1
                },
                {
                    text: 'State',
                    dataIndex: 'State'
                },
                //{
                //    text: 'Owner',
                //    dataIndex: 'Owner'
                //},
                {
                    text: 'Project',
                    dataIndex: 'Project'
                },
                {
                    text: 'CreationDate',
                    dataIndex: 'CreationDate'
                },
                {
                    text: 'ClosedDate',
                    dataIndex: 'ClosedDate'
                },
                {
                    text: 'Resolution',
                    dataIndex: 'Resolution'
                },
                {
                    text: 'Priority',
                    dataIndex: 'Priority'
                }
            ],
            showPagingToolbar:true,
            cls: ''
        });
    },
    prepareChart: function(){
        this.series = [];
        this.data = [[],[],[],[]];
        
        var chartData = [],
            numOfWeeksRunningDri1 = this.ttr1/7,
            numOfWeeksRunningDri2 = this.ttr2/7;
            
        _.each(this.allData, function(o){
            chartData.push({
                'dri1'      :   o[3],
                'dri2'      :   o[4],
                'endWeek'   :   o[6] 
            });
        });
        
        console.log('chartData...');
        _.each(chartData,function(o){
            this.categories.push(o.endWeek);
            this.data[0].push(parseFloat(o.dri1));
            this.data[1].push(parseFloat(o.dri2));
        },this);
        
        console.log(' this.data[0] before splice....', this.data[0]);
        this.data[2] = this.data[0].splice(0, this.data[0].length - numOfWeeksRunningDri1); 
        this.data[3] = this.data[1].splice(0, this.data[1].length - numOfWeeksRunningDri2);
        
        for(var a=0;a<this.numberOfWeeks-numOfWeeksRunningDri1;a++){
            this.data[0].unshift(null);
        }
        for(var b=0;b<this.numberOfWeeks-numOfWeeksRunningDri2;b++){
            this.data[1].unshift(null);
        }
        
        
        console.log('this.data...');
        _.each(this.data, function(subArray){
            console.log(subArray);
            
        });
        this.series.push({
            name: '4 week running DRI',
            data: this.data[0],
            color: ['#87CEEB'],
            dashStyle: 'Dot'//'ShortDash',
        });
        this.series.push({
            name: '4 week DRI',
            color:['#008080'],
            data: this.data[2]
        });
        this.series.push({
            name: '12 week running DRI',
            data: this.data[1],
            color: ['#8FBC8F'],
            dashStyle: 'Dot'//'ShortDash',
        });
        this.series.push({
            name: '12 week DRI',
            color:['#008080'],
            data: this.data[3]
        });
        this.makeChart();
    },
    makeChart:function(){
        var that = this;
        //console.log('this.categories',this.categories);
        //console.log('this.series...');
        //_.each(this.series,function(series){
        //    console.log(series);
        //});
        this.down('#chartPanel').add({
            xtype: 'rallychart',
            chartConfig: {
                chart:{
                    type: 'line',
                    zoomType: 'xy'
                },
                title:{
                    text: '4 week and 12 week DRI'
                },
                colors: ['#87CEEB', '#8FBC8F', '#008080','#008080'],
                xAxis: {
                    title: {
                        enabled: true
                    },
                    tickInterval: 1,
                    startOnTick: true,
                    endOnTick: true,
                    showLastLabel: true,
                    allowDecimals: false
                },
                yAxis:{
                    title: {
                        text: 'Defect Resolution Index'
                    },
                    allowDecimals: false,
                    min : 0
                },
                plotOptions: {
                    line: {
                        connectNulls: false
                    }
                }
            },
                            
            chartData: {
                series: that.series,
                categories: that.categories
            }
          
        });
    }
});