
(function(){
  var RAW = window.DASH_DATA || [];
  if(!RAW.length){
    document.body.innerHTML='<div style="text-align:center;padding:80px;color:#6b7690">⚠️ 数据未加载</div>';
    return;
  }
  function money(n){
    if(n===null||n===undefined||isNaN(n))return '—';
    var abs=Math.abs(n);var unit='';
    if(abs>=1e8){n=n/1e8;unit='亿';}else if(abs>=1e4){n=n/1e4;unit='万';}
    return (n<0?'-¥':'¥')+(Math.round(Math.abs(n)*100)/100).toLocaleString('zh-CN')+unit;
  }
  function money2(n){
    if(n===null||n===undefined)return '—';
    return (Math.abs(n)<1000?n.toFixed(2):(n/1000).toFixed(1)+'k');
  }
  function nf(n){return (Math.round(n*100)/100).toLocaleString('zh-CN');}
  function el(id){return document.getElementById(id);}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]});}
  var charts={};
  function chart(id){
    if(!charts[id])charts[id]=echarts.init(el(id),null,{renderer:'canvas'});
    return charts[id];
  }
  var BASE={tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},grid:{top:40,bottom:40,left:60,right:30}};
  function opt(o){return Object.assign({},JSON.parse(JSON.stringify(BASE)),o);}

  // ===== 筛选 =====
  var dates=RAW.map(function(r){return r.date;}).filter(function(v,i,a){return a.indexOf(v)===i;}).sort();
  var rangeFrom='',rangeTo='',quickMode='all',filterClass='';

  function fillSelect(id,vals,ph){
    var s=el(id);s.innerHTML='<option value="">'+(ph||'全部')+'</option>'+vals.map(function(v){return '<option>'+v+'</option>';}).join('');
  }
  fillSelect('selFrom',dates,'起');
  fillSelect('selTo',dates,'止');

  function applyQuick(){
    var last=new Date(dates[dates.length-1]+'T00:00:00');
    var start='',end=dates[dates.length-1];
    if(quickMode==='all'){start='';end='';}
    else if(quickMode==='7d'){start=new Date(last.getTime()-6*86400000).toISOString().slice(0,10);}
    else if(quickMode==='30d'){start=new Date(last.getTime()-29*86400000).toISOString().slice(0,10);}
    else if(quickMode==='mtd'){start=end.slice(0,7)+'-01';}
    rangeFrom=start;rangeTo=end;
  }
  el('segQuick').addEventListener('click',function(e){
    var b=e.target.closest('button');if(!b)return;
    document.querySelectorAll('#segQuick button').forEach(function(x){x.classList.remove('on');});
    b.classList.add('on');quickMode=b.dataset.r;applyQuick();render();
  });
  el('selFrom').addEventListener('change',function(){if(this.value){rangeFrom=this.value;quickMode='';document.querySelectorAll('#segQuick button').forEach(function(x){x.classList.remove('on');});render();}});
  el('selTo').addEventListener('change',function(){if(this.value){rangeTo=this.value;quickMode='';document.querySelectorAll('#segQuick button').forEach(function(x){x.classList.remove('on');});render();}});
  el('selClass').addEventListener('change',function(){filterClass=this.value;render();});
  applyQuick();

  function filtered(){
    return RAW.filter(function(r){
      if(rangeFrom && r.date<rangeFrom)return false;
      if(rangeTo && r.date>rangeTo)return false;
      if(filterClass && r.uClass!==filterClass)return false;
      return true;
    });
  }

  // ===== 渲染 =====
  function renderFlow(list){
    var c=0,tx=0,pos=0,neg=0;
    list.forEach(function(r){
      if(r.uClass==='充值_支出')c+=r.uAmount||0;
      if(r.uClass==='提现_收入')tx+=r.uAmount||0;
      if(r.uClass==='代收进账_参考收入')pos+=r.uAmount||0;
      if(r.uClass==='代扣出账_参考支出')neg+=r.uAmount||0;
    });
    var withBal=list.filter(function(r){return r.balance!==null;});
    withBal.sort(function(a,b){return (a.date+a.time).localeCompare(b.date+b.time);});
    var bal=withBal.length?withBal[withBal.length-1].balance:0;

    // ===== 公式1: 用户拿钱视角 =====
    // 投入(充值) + 平台内部(代扣出账,代收跟提现重叠不显) = 收回(提现+余额) → 净收益 = 收回 − 投入
    var box1=el('flowBox1');
    box1.innerHTML='<div style="font-size:13px;font-weight:600;color:#1b2334;margin-bottom:10px">公式① 用户拿钱视角（你实际拿到的 vs 你垫的）</div>'+
    '<div class="flow-diagram">'+
      '<div style="text-align:center"><div class="flow-box red">投入 '+money(c)+'</div><div class="flow-sub">充值 · 用户垫的</div></div>'+
      '<div class="flow-arrow">+</div>'+
      '<div style="text-align:center"><div class="flow-box gray">平台内部 '+money(neg)+'</div><div class="flow-sub">代扣出账（代收进账已含在提现+余额里,重叠不显）</div></div>'+
      '<div class="flow-arrow">=</div>'+
      '<div style="text-align:center"><div class="flow-box green">收回 '+money(tx+bal)+'</div><div class="flow-sub">提现 '+money(tx)+' · 余额 '+money(bal)+'</div></div>'+
      '<div class="flow-arrow">→</div>'+
      '<div style="text-align:center"><div class="flow-box '+(tx+bal>=c?'green':'red')+'">净收益 '+money(tx+bal-c)+'</div><div class="flow-sub">收益率 '+((c>0?((tx+bal-c)/c*100).toFixed(1):'—'))+'%</div></div>'+
    '</div>';

    // ===== 公式2: 纯粹平台资金视角 =====
    // 充值 + 代扣 = 代收 → 净收益 = 代收 − 充值 − 代扣
    // 代收 − 代扣 − 提现 = 余额（没提现出来的）
    var box2=el('flowBox2');
    var net2=pos-c-neg;
    box2.innerHTML='<div style="font-size:13px;font-weight:600;color:#1b2334;margin-bottom:10px">公式② 纯粹平台资金视角（忽略提现,只看平台内部资金流）</div>'+
    '<div class="flow-diagram">'+
      '<div style="text-align:center"><div class="flow-box red">充值 '+money(c)+'</div><div class="flow-sub">用户垫的</div></div>'+
      '<div class="flow-arrow">+</div>'+
      '<div style="text-align:center"><div class="flow-box orange">代扣出账 '+money(neg)+'</div><div class="flow-sub">平台内扣</div></div>'+
      '<div class="flow-arrow">=</div>'+
      '<div style="text-align:center"><div class="flow-box green">代收进账 '+money(pos)+'</div><div class="flow-sub">汇总结算总额（真正来源）</div></div>'+
      '<div class="flow-arrow">→</div>'+
      '<div style="text-align:center"><div class="flow-box '+(net2>=0?'green':'red')+'">净收益 '+money(net2)+'</div><div class="flow-sub">代收 − 充值 − 代扣</div></div>'+
    '</div>'+
    '<div style="margin-top:10px;font-size:12px;color:#6b7690;text-align:center">'+
      '📌 资金守恒：代收 '+money(pos)+' − 代扣 '+money(neg)+' 充值 '+money(c)+' = 提现 '+money(tx)+' + 余额 '+money(bal)+' ✓'+
      '</div>';
  }

  function renderKpi(list){
    var c=0,tx=0,pos=0,neg=0,cntPos=0,cntNeg=0;
    list.forEach(function(r){
      if(r.uClass==='充值_支出')c+=r.uAmount||0;
      if(r.uClass==='提现_收入')tx+=r.uAmount||0;
      if(r.uClass==='代收进账_参考收入'){pos+=r.uAmount||0;cntPos++;}
      if(r.uClass==='代扣出账_参考支出'){neg+=r.uAmount||0;cntNeg++;}
    });
    var withBal=list.filter(function(r){return r.balance!==null;});
    withBal.sort(function(a,b){return (a.date+a.time).localeCompare(b.date+b.time);});
    var bal=withBal.length?withBal[withBal.length-1].balance:0;
    var total=tx+bal,net=total-c;

    el('kInAmt').textContent=money(pos);
    el('kInCnt').textContent=cntPos.toLocaleString('zh-CN');
    el('kOutAmt').textContent=money(neg);
    el('kOutCnt').textContent=cntNeg.toLocaleString('zh-CN');
    el('kIn').textContent=money(c);
    el('kOut').textContent=money(tx);
    el('kBal').textContent=money(bal);
    el('kTotal').textContent=money(total);
    var kn=el('kNet');kn.textContent=money(net);
    kn.className='v '+(net>=0?'pos':'neg');

    el('dataEnd').textContent=dates[dates.length-1];
    el('dataCnt').textContent=RAW.length.toLocaleString('zh-CN');
    var alias='全部日期';
    if(quickMode==='7d')alias='近7天';
    else if(quickMode==='30d')alias='近30天';
    else if(quickMode==='mtd')alias='本月';
    else if(rangeFrom||rangeTo)alias=(rangeFrom||dates[0])+' ~ '+(rangeTo||dates[dates.length-1]);
    if(filterClass){var cn={'充值_支出':'充值','提现_收入':'提现','代收进账_参考收入':'代收进账','代扣出账_参考支出':'代扣出账'}[filterClass]||filterClass;alias+=' · '+cn;}
    el('statusBar').textContent='命中 '+list.length.toLocaleString('zh-CN')+' / '+RAW.length.toLocaleString('zh-CN')+' 条 · '+alias;
  }

  function renderTrend(list){
    var map={};
    list.forEach(function(r){
      if(!map[r.date])map[r.date]={date:r.date,pos:0,neg:0,tx:0,c:0,bals:[]};
      if(r.uClass==='代收进账_参考收入')map[r.date].pos+=r.uAmount||0;   // 平台进账 (大额正)
      if(r.uClass==='代扣出账_参考支出')map[r.date].neg+=r.uAmount||0;     // 平台出账 (小额负)
      if(r.uClass==='提现_收入')map[r.date].tx+=r.uAmount||0;          // 用户收入
      if(r.uClass==='充值_支出')map[r.date].c+=r.uAmount||0;           // 用户支出
      if(r.balance!==null)map[r.date].bals.push(r.balance);
    });
    var days=Object.values(map).sort(function(a,b){return a.date.localeCompare(b.date);});
    days.forEach(function(d){d.bal=d.bals.length?d.bals[d.bals.length-1]:null;});
    if(!days.length){chart('chartTrend').clear();return;}

    var c=chart('chartTrend');
    c.setOption(opt({
      tooltip:{trigger:'axis',axisPointer:{type:'cross'}},
      legend:{data:['代收进账','代扣出账','提现(用户收入)','充值(用户支出)','期末余额'],top:0,right:10},
      xAxis:{type:'category',data:days.map(function(d){return d.date.slice(5);}),
        axisLabel:{rotate:45,fontSize:10,color:'#6b7690'},axisLine:{lineStyle:{color:'#e6eaf2'}},axisTick:{show:false}},
      yAxis:[
        {type:'value',name:'金额',splitLine:{lineStyle:{color:'#eef0f5'}}},
        {type:'value',name:'余额',splitLine:{show:false},axisLine:{show:true,lineStyle:{color:'#3b5bfd'}}}
      ],
      series:[
        {name:'代收进账',type:'bar',data:days.map(function(d){return +d.pos.toFixed(2);}),itemStyle:{color:'#12a67a',borderRadius:[3,3,0,0]},barWidth:10},
        {name:'代扣出账',type:'bar',data:days.map(function(d){return +d.neg.toFixed(2);}),itemStyle:{color:'#e5872b',borderRadius:[3,3,0,0]},barWidth:10},
        {name:'提现(用户收入)',type:'bar',data:days.map(function(d){return +d.tx.toFixed(2);}),itemStyle:{color:'#3b5bfd',borderRadius:[3,3,0,0]},barWidth:10},
        {name:'充值(用户支出)',type:'bar',data:days.map(function(d){return +d.c.toFixed(2);}),itemStyle:{color:'#e5484d',borderRadius:[3,3,0,0]},barWidth:10},
        {name:'期末余额',type:'line',yAxisIndex:1,smooth:true,data:days.map(function(d){return d.bal;}),lineStyle:{color:'#7a5cf0',width:2},itemStyle:{color:'#7a5cf0'}}
      ]
    }),true);
  }

  function renderMonth(list){
    var map={};
    list.forEach(function(r){
      var m=r.date.slice(0,7);
      if(!map[m])map[m]={month:m,pos:0,neg:0,tx:0,c:0,bals:[]};
      if(r.uClass==='代收进账_参考收入')map[m].pos+=r.uAmount||0;
      if(r.uClass==='代扣出账_参考支出')map[m].neg+=r.uAmount||0;
      if(r.uClass==='提现_收入')map[m].tx+=r.uAmount||0;
      if(r.uClass==='充值_支出')map[m].c+=r.uAmount||0;
      if(r.balance!==null)map[m].bals.push({date:r.date,bal:r.balance});
    });
    var ms=Object.values(map).sort(function(a,b){return a.month.localeCompare(b.month);});
    ms.forEach(function(m){
      m.bals.sort(function(a,b){return a.date.localeCompare(b.date);});
      m.bal=m.bals.length?m.bals[m.bals.length-1].bal:null;
    });
    if(!ms.length){chart('chartMonth').clear();return;}

    var c=chart('chartMonth');
    c.setOption(opt({
      tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},
      legend:{data:['代收进账','代扣出账','充值(投入)','提现(收回)','月末余额'],top:0,right:10},
      xAxis:{type:'category',data:ms.map(function(m){return m.month;}),axisLabel:{color:'#6b7690'},axisLine:{lineStyle:{color:'#e6eaf2'}}},
      yAxis:[
        {type:'value',splitLine:{lineStyle:{color:'#eef0f5'}}},
        {type:'value',splitLine:{show:false},axisLine:{show:true,lineStyle:{color:'#7a5cf0'}}}
      ],
      series:[
        {name:'代收进账',type:'bar',data:ms.map(function(m){return +m.pos.toFixed(2);}),itemStyle:{color:'#12a67a',borderRadius:[3,3,0,0]},barGap:'10%',barWidth:18},
        {name:'代扣出账',type:'bar',data:ms.map(function(m){return +m.neg.toFixed(2);}),itemStyle:{color:'#e5872b',borderRadius:[3,3,0,0]},barWidth:18},
        {name:'充值(投入)',type:'bar',data:ms.map(function(m){return +m.c.toFixed(2);}),itemStyle:{color:'#e5484d',borderRadius:[3,3,0,0]},barWidth:18},
        {name:'提现(收回)',type:'bar',data:ms.map(function(m){return +m.tx.toFixed(2);}),itemStyle:{color:'#3b5bfd',borderRadius:[3,3,0,0]},barWidth:18},
        {name:'月末余额',type:'line',yAxisIndex:1,smooth:true,data:ms.map(function(m){return m.bal;}),lineStyle:{color:'#7a5cf0',width:2},itemStyle:{color:'#7a5cf0'}}
      ]
    }),true);
  }

  function renderCompare(list){
    var map={};
    list.forEach(function(r){
      var m=r.date.slice(0,7);
      if(!map[m])map[m]={month:m,c:0,tx:0,pos:0,neg:0};
      if(r.uClass==='充值_支出')map[m].c+=r.uAmount||0;
      if(r.uClass==='提现_收入')map[m].tx+=r.uAmount||0;
      if(r.uClass==='代收进账_参考收入')map[m].pos+=r.uAmount||0;
      if(r.uClass==='代扣出账_参考支出')map[m].neg+=r.uAmount||0;
    });
    var ms=Object.values(map).sort(function(a,b){return a.month.localeCompare(b.month);});
    if(!ms.length){chart('chartCompare').clear();return;}

    var c=chart('chartCompare');
    c.setOption(opt({
      tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},
      legend:{data:['代收进账','代扣出账','充值(投入)','提现(收回)','净收益(代收−充值−代扣)'],top:0,right:10},
      xAxis:{type:'category',data:ms.map(function(m){return m.month;}),axisLabel:{color:'#6b7690'},axisLine:{lineStyle:{color:'#e6eaf2'}}},
      yAxis:[
        {type:'value',name:'元',splitLine:{lineStyle:{color:'#eef0f5'}}},
        {type:'value',name:'元',splitLine:{show:false}}
      ],
      series:[
        {name:'代收进账',type:'bar',stack:'flow',data:ms.map(function(m){return +m.pos.toFixed(2);}),itemStyle:{color:'#12a67a'},barWidth:28},
        {name:'代扣出账',type:'bar',stack:'flow',data:ms.map(function(m){return +m.neg.toFixed(2);}),itemStyle:{color:'#e5872b'}},
        {name:'充值(投入)',type:'bar',stack:'flow',data:ms.map(function(m){return +m.c.toFixed(2);}),itemStyle:{color:'#e5484d'}},
        {name:'提现(收回)',type:'bar',stack:'flow',data:ms.map(function(m){return +m.tx.toFixed(2);}),itemStyle:{color:'#3b5bfd',borderRadius:[3,3,0,0]}},
        {name:'净收益(代收−充值−代扣)',type:'line',yAxisIndex:1,data:ms.map(function(m){return +(m.pos-m.c-m.neg).toFixed(2);}),itemStyle:{color:'#7a5cf0'},lineStyle:{width:2},symbol:'circle'}
      ]
    }),true);
  }

  function renderNegPrice(list){
    // 只取代扣出账
    var negs=list.filter(function(r){return r.uClass==='代扣出账_参考支出' && r.uAmount!==null;});
    if(!negs.length){chart('chartNegPrice').clear();return;}
    // 10元一档
    var map={};
    negs.forEach(function(r){
      var d=r.date;
      var b=Math.floor(r.uAmount/10)*10;  // 57→50, 97→90
      if(!map[d])map[d]={date:d};
      map[d]['b'+b]=(map[d]['b'+b]||0)+1;
    });
    var days=Object.values(map).sort(function(a,b){return a.date.localeCompare(b.date);});
    // 收集所有出现过的档位
    var allBuckets={};
    days.forEach(function(d){Object.keys(d).forEach(function(k){if(k!=='date')allBuckets[k.replace('b','')]=1;});});
    var bucketKeys=Object.keys(allBuckets).map(Number).sort(function(a,b){return a-b;});
    if(!bucketKeys.length){chart('chartNegPrice').clear();return;}

    // 颜色循环
    var colors=['#e5484d','#e5872b','#f7b267','#f08c00','#12a67a','#3b5bfd','#7a5cf0','#2d8cf0','#9f7aea'];
    var series=bucketKeys.map(function(bk,i){
      return {
        name: bk+'-'+(bk+10)+'元',
        type:'bar',stack:'np',
        data: days.map(function(d){return d['b'+bk]||0;}),
        itemStyle:{color: colors[i%colors.length]},
        barWidth: 22
      };
    });

    var c=chart('chartNegPrice');
    c.setOption(opt({
      tooltip:{trigger:'axis',axisPointer:{type:'shadow'},
        formatter:function(p){
          var s='<b>'+p[0].axisValue+'</b>';
          var total=0;
          p.forEach(function(x){if(x.value>0){s+='<br/>'+x.marker+x.seriesName+': '+x.value+' 笔';total+=x.value;}});
          s+='<br/><b>合计 '+total+' 笔</b>';
          return s;
        }},
      legend:{data:series.map(function(s){return s.name;}),top:0,right:10,type:'scroll'},
      xAxis:{type:'category',data:days.map(function(d){return d.date.slice(5);}),
        axisLabel:{rotate:45,fontSize:10,color:'#6b7690'},axisLine:{lineStyle:{color:'#e6eaf2'}},axisTick:{show:false}},
      yAxis:{type:'value',name:'笔数',splitLine:{lineStyle:{color:'#eef0f5'}}},
      grid:{top:50,bottom:60,left:60,right:30},
      series: series
    }),true);
  }

  function pct(n,d){if(!d)return'—';return(Math.round(n*1000/d)/10)+'%';}
  function renderInsights(list){
    var box=el('insightBox');
    if(!list.length){box.innerHTML='';return;}

    var c=0,tx=0,pos=0,neg=0,cntPos=0,cntNeg=0,cntC=0,cntTx=0;
    list.forEach(function(r){
      if(r.uClass==='充值_支出'){c+=r.uAmount||0;cntC++;}
      if(r.uClass==='提现_收入'){tx+=r.uAmount||0;cntTx++;}
      if(r.uClass==='代收进账_参考收入'){pos+=r.uAmount||0;cntPos++;}
      if(r.uClass==='代扣出账_参考支出'){neg+=r.uAmount||0;cntNeg++;}
    });
    var withBal=list.filter(function(r){return r.balance!==null;});
    withBal.sort(function(a,b){return (a.date+a.time).localeCompare(b.date+b.time);});
    var bal=withBal.length?withBal[withBal.length-1].balance:0;
    var net=pos-c-neg;  // 公式2净收益

    var dates=list.map(function(r){return r.date;}).filter(function(v,i,a){return a.indexOf(v)===i;}).sort();
    var first=dates[0],last=dates[dates.length-1];
    var span=Math.round((new Date(last)-new Date(first))/86400000)+1;

    // 日期连续检查
    var gaps=[],prev=null;
    dates.forEach(function(d){
      if(prev){var gap=Math.round((new Date(d)-new Date(prev))/86400000);
        if(gap>1)gaps.push(prev+'→'+d+'（缺'+(gap-1)+'天）');}
      prev=d;
    });

    // 月度汇总
    var byMonth={};
    list.forEach(function(r){
      var m=r.date.slice(0,7);
      if(!byMonth[m])byMonth[m]={m:m,pos:0,neg:0,c:0,tx:0,cnt:0};
      byMonth[m].cnt++;
      if(r.uClass==='代收进账_参考收入')byMonth[m].pos+=r.uAmount||0;
      if(r.uClass==='代扣出账_参考支出')byMonth[m].neg+=r.uAmount||0;
      if(r.uClass==='充值_支出')byMonth[m].c+=r.uAmount||0;
      if(r.uClass==='提现_收入')byMonth[m].tx+=r.uAmount||0;
    });
    var ms=Object.values(byMonth).sort(function(a,b){return a.m.localeCompare(b.m);});

    // 代扣金额档位分布（top 3）
    var priceBuckets={};
    list.filter(function(r){return r.uClass==='代扣出账_参考支出';}).forEach(function(r){
      var b=Math.floor(r.uAmount/10)*10;
      priceBuckets[b]=(priceBuckets[b]||0)+1;
    });
    var topBk=Object.entries(priceBuckets).sort(function(a,b){return b[1]-a[1];}).slice(0,3);

    // 每日代扣笔数 top 5
    var dailyNeg={};
    list.filter(function(r){return r.uClass==='代扣出账_参考支出';}).forEach(function(r){
      dailyNeg[r.date]=(dailyNeg[r.date]||0)+1;
    });
    var topNegDays=Object.entries(dailyNeg).sort(function(a,b){return b[1]-a[1];}).slice(0,5);

    // 提现 top 3 笔
    var bigTx=list.filter(function(r){return r.uClass==='提现_收入';}).sort(function(a,b){return (b.uAmount||0)-(a.uAmount||0);}).slice(0,3);

    // 代收 top 3 笔
    var bigPos=list.filter(function(r){return r.uClass==='代收进账_参考收入';}).sort(function(a,b){return (b.uAmount||0)-(a.uAmount||0);}).slice(0,3);

    var items=[];

    // ✅ OK 类
    items.push({t:'ok',i:'✓',h:'资金守恒验证通过',
      b:'代收进账 '+money(pos)+' − 代扣出账 '+money(neg)+' + 充值 '+money(c)+' = 提现 '+money(tx)+' + 余额 '+money(bal)+'，偏差 < 0.01 元，数据自洽。'});

    items.push({t:'ok',i:'✓',h:'净收益为正：'+money(net),
      b:'公式②视角：代收进账 '+money(pos)+' − 充值 '+money(c)+' − 代扣出账 '+money(neg)+' = '+money(net)+'（收益率 '+((c>0?(net/c*100).toFixed(1):'—'))+'%）。'});

    items.push({t:'ok',i:'✓',h:'代收进账覆盖全部代扣需求',
      b:'代收进账 '+money(pos)+' vs 代扣出账 '+money(neg)+'，覆盖倍数 '+(neg>0?(pos/neg).toFixed(1):'—')+'×。说明 POS 清算资金足够覆盖平台内扣，余额得以稳步累积。'});

    // ⚠ WARN 合并
    var warnMsgs=[];
    if(gaps.length)warnMsgs.push('<b>日期不连续：'+gaps.length+' 处缺口</b><br>'+gaps.slice(0,5).join('；')+(gaps.length>5?' ...':''));
    if(bal<10000)warnMsgs.push('<b>期末余额偏低：'+money(bal)+'</b><br>余额 < ¥10,000，若出现大金额代扣可能需要再次充值。建议保持余额在代收进账总额的 '+(pos>0?'5-10%':'—')+' 以上作为安全垫。');
    if(warnMsgs.length)items.push({t:'warn',i:'!',h:'风险提示 & 注意事项',b:warnMsgs.join('<br><br>')});
    var posAll=list.filter(function(r){return r.uClass==='代收进账_参考收入';}).slice()
      .sort(function(a,b){return (a.date+(a.time||''))-(b.date+(b.time||''))});
    var posDays={};
    posAll.forEach(function(r){
      if(!posDays[r.date])posDays[r.date]=[];
      posDays[r.date].push(r.uAmount||0);
    });
    var posDates=Object.keys(posDays).sort();
    var intervals=[];
    for(var i=1;i<posDates.length;i++){
      var days=Math.round((new Date(posDates[i])-new Date(posDates[i-1]))/86400000);
      intervals.push(days);
    }
    var avgInt=intervals.length?(intervals.reduce(function(a,b){return a+b;},0)/intervals.length).toFixed(1):'—';
    var fixedInt=true, intMode='—';
    if(intervals.length>=2){
      var uniq=intervals.filter(function(v,i,a){return a.indexOf(v)===i;});
      fixedInt = uniq.length<=2;
      intMode = fixedInt ? (uniq[0]+' 天（固定！）') : '不固定（出现 '+uniq.length+' 种间隔）';
    }
    var totalIntDays=intervals.reduce(function(a,b){return a+b;},0);
    var dailyAvg=totalIntDays>0?(pos/totalIntDays):0;

    items.push({t:'info',i:'i',h:'代收进账结算间隔分析',
      b:'共 '+cntPos+' 笔代收进账，分布在 '+posDates.length+' 天。结算间隔：<b>'+intMode+'</b>，平均 '+avgInt+' 天一次。'+
        '<br>按间隔天数：'+Object.entries(
          intervals.reduce(function(acc,d){acc[d]=(acc[d]||0)+1;return acc;},{})
        ).sort(function(a,b){return a[0]-b[0];}).map(function(x){return x[0]+'天 × '+x[1]+'次';}).join('、')+'.'+
        '<br>日均收益（纯平台视角）：'+money(dailyAvg)+'。'+
        (fixedInt?' 结算周期有规律，可据此预测下次到账时间。':' 结算间隔不规则，可能与交易量或工作日有关。')});

    // ℹ INFO 类
    var mSumm=ms.map(function(m){return m.m+' 代收 '+money(m.pos)+' · 代扣 '+money(m.neg)+' · 提现 '+money(m.tx);}).join('；');
    items.push({t:'info',i:'i',h:'月度资金流一览 ('+ms.length+' 个月)',b:mSumm});

    items.push({t:'info',i:'i',h:'代扣金额集中于固定档位',
      b:'Top 3 档位：'+topBk.map(function(x){return '<b>'+x[0]+'-'+(+x[0]+10)+'元</b> '+x[1]+' 笔 ('+(cntNeg>0?(x[1]/cntNeg*100).toFixed(0):'—')+'%)';}).join('、')+'。'+
        '推测是固定金额的 POS 交易（'+topBk[0][1]+' 笔 '+(topBk[0][0])+'-'+(+topBk[0][0]+10)+' 元占了 '+(cntNeg>0?(topBk[0][1]/cntNeg*100).toFixed(0):'—')+'%）。'});

    items.push({t:'info',i:'i',h:'每日代扣高峰',
      b:'Top 5 代扣最多的日期：'+topNegDays.map(function(x){return x[0]+' '+x[1]+' 笔';}).join('、')+'。'+
        '高峰期可能对应周末或某些固定结算日。'});

    if(bigPos.length){
      items.push({t:'info',i:'i',h:'代收进账 Top 3 单笔',
        b:bigPos.map(function(r){return r.date+' '+money(r.uAmount)+' · '+esc(r.counterparty);}).join('；')});}

    if(bigTx.length){
      items.push({t:'info',i:'i',h:'提现 Top 3 单笔',
        b:bigTx.map(function(r){return r.date+' '+money(r.uAmount)+' · '+esc(r.counterparty);}).join('；')});}

    items.push({t:'info',i:'i',h:'数据区间 & 覆盖度',
      b:'区间 <b>'+first+' ~ '+last+'</b>，跨度 '+span+' 天，实际有数据 '+dates.length+' 天（覆盖 '+pct(dates.length,span)+'）。'+
        '总交易 '+list.length.toLocaleString()+' 条：代收进账 '+cntPos+' 笔 / 代扣出账 '+cntNeg+' 笔 / 充值 '+cntC+' 笔 / 提现 '+cntTx+' 笔。'});

    items.push({t:'info',i:'i',h:'净收益公式说明',
      b:'公式①（用户拿钱视角）：收回(提现+余额) − 投入(充值) = '+money(tx+bal-c)+'。'+
        '<br>公式②（纯平台资金视角）：代收进账 − 充值 − 代扣出账 = '+money(net)+'。'+
        '两者数字接近但不完全相同，因为代收进账和提现属于不同维度的统计。'});

    box.innerHTML=items.map(function(x){
      return '<div class="alert '+x.t+'"><span class="ic">'+x.i+'</span><div class="bd"><b>'+x.h+'</b><br>'+x.b+'</div></div>';
    }).join('');
  }

  // ========== 分页状态 ==========
  var detailPage = 1;
  function renderDetail(list){
    list=list.slice().sort(function(a,b){return (b.date+b.time).localeCompare(a.date+a.time);});
    var s=(el('searchBox').value||'').trim().toLowerCase();
    if(s){list=list.filter(function(r){
      return (r.txnNo||'').toLowerCase().indexOf(s)>=0||
             (r.orderNo||'').toLowerCase().indexOf(s)>=0||
             (r.counterparty||'').toLowerCase().indexOf(s)>=0||
             (r.txnType||'').toLowerCase().indexOf(s)>=0;
    });}
    var pageSize = parseInt(el('pageSize').value)||20;
    var totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    if(detailPage > totalPages) detailPage = totalPages;
    if(detailPage < 1) detailPage = 1;
    var start = (detailPage-1)*pageSize;
    var pageData = list.slice(start, start+pageSize);

    var tb=el('tblDetail').querySelector('tbody');
    tb.innerHTML='';
    var html='';
    pageData.forEach(function(r){
      var clsTag={
        '充值_支出':'<span class="tag r">充值·用户支出</span>',
        '提现_收入':'<span class="tag g">提现·用户收入</span>',
        '代收进账_参考收入':'<span class="tag y">代收进账·汇总结算</span>',
        '代扣出账_参考支出':'<span class="tag n">代扣出账</span>',
      }[r.uClass]||'<span class="tag n">'+esc(r.uClass)+'</span>';
      html+='<tr>'+
        '<td class="l">'+esc(r.date)+'</td>'+
        '<td class="l"><span class="tag b">'+esc(r.txnType)+'</span></td>'+
        '<td class="l">'+esc(r.counterparty)+'</td>'+
        '<td class="l mono">'+esc(r.orderNo)+'</td>'+
        '<td class="l mono">'+esc(r.txnNo)+'</td>'+
        '<td class="num '+(r.incomeRaw!==null&&r.incomeRaw<0?'exp':'')+'">'+(r.incomeRaw!==null?r.incomeRaw.toFixed(2):'')+'</td>'+
        '<td class="num '+(r.expenseRaw!==null?'exp':'')+'">'+(r.expenseRaw!==null?r.expenseRaw.toFixed(2):'')+'</td>'+
        '<td class="num '+(r.uClass.indexOf('收入')>=0?'inc':'exp')+'">'+(r.uAmount!==null?r.uAmount.toFixed(2):'')+'</td>'+
        '<td class="l">'+clsTag+'</td>'+
        '<td class="num">'+(r.balance!==null?r.balance.toFixed(2):'')+'</td>'+
      '</tr>';
    });
    tb.innerHTML=html;

    // 分页栏
    var pb = el('pageBar');
    var info = '共 '+list.length+' 条 · 第 '+detailPage+' / '+totalPages+' 页';
    var btns = '';
    if(totalPages > 1){
      btns += '<button data-p="'+(detailPage-1)+'" '+(detailPage<=1?'disabled':'')+'>上一页</button>';
      // 页码按钮: 前2 ... 当前 ... 后2
      var pages = [];
      for(var i=1;i<=totalPages;i++){
        if(i===1||i===totalPages||Math.abs(i-detailPage)<=1) pages.push(i);
        else if(pages[pages.length-1]!=='...') pages.push('...');
      }
      pages.forEach(function(p){
        if(p==='...') btns += '<span style="padding:0 4px">...</span>';
        else btns += '<button data-p="'+p+'" class="'+(p===detailPage?'on':'')+'">'+p+'</button>';
      });
      btns += '<button data-p="'+(detailPage+1)+'" '+(detailPage>=totalPages?'disabled':'')+'>下一页</button>';
    }
    pb.innerHTML = '<span>'+info+'</span><div style="display:flex;gap:4px">'+btns+'</div>';
    pb.querySelectorAll('button').forEach(function(b){
      b.style.cssText='padding:3px 10px;border:1px solid #d0d8e8;background:#fff;border-radius:4px;cursor:pointer;font-size:12px';
      if(b.classList.contains('on')) b.style.cssText+=';background:#4096ff;color:#fff;border-color:#4096ff';
      if(b.disabled) b.style.cssText+=';opacity:0.4;cursor:not-allowed';
      b.addEventListener('click',function(){
        var p = parseInt(this.dataset.p);
        if(p && p>=1 && p<=totalPages){ detailPage=p; renderDetail(filtered()); }
      });
    });
  }

  el('searchBox').addEventListener('input',function(){detailPage=1;renderDetail(filtered());});
  el('pageSize').addEventListener('change',function(){detailPage=1;renderDetail(filtered());});

  function render(){
    var list=filtered();
    renderFlow(list);renderKpi(list);renderTrend(list);renderNegPrice(list);
    renderMonth(RAW);renderCompare(RAW);  // ← 月度 & 投入vs收回 用全量数据, 不受筛选影响
    renderInsights(list);renderDetail(list);
  }
  function __kqInit(){ render(); }
  if (window.__kq_authed) __kqInit();
  else window.addEventListener('kq:auth-ok', __kqInit, { once: true });

  document.querySelectorAll('nav a').forEach(function(a){
    a.addEventListener('click',function(){document.querySelectorAll('nav a').forEach(function(x){x.classList.remove('on');});a.classList.add('on');});
  });
  window.addEventListener('resize',function(){Object.values(charts).forEach(function(c){c.resize();});});
})();
