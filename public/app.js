let dept='fb', adminPin='', manageOpen=false, lastReceipt=null, lastReceiptLang='vi', catalogItems=[];
const DEPTS={fb:{eyebrow:'F&B',title:'Quản lý công cụ F&B',items:['Ly thủy tinh','Ly rượu vang','Tách cà phê','Muỗng','Nĩa','Dao ăn','Đĩa','Tô','Khay','Xô đá','Bình nước','Dụng cụ mở rượu']},housekeeping:{eyebrow:'HOUSEKEEPING',title:'Quản lý công cụ Housekeeping',items:['Bàn ủi','Cầu là','Móc áo','Gối','Chăn','Khăn tắm','Khăn mặt','Máy sấy tóc','Ổ cắm nối dài','Nôi em bé','Ghế em bé']},reception:{eyebrow:'LỄ TÂN',title:'Quản lý công cụ Lễ tân',items:['Ô / dù','Adapter','Sạc điện thoại','Ổ cắm','Kéo','Cân hành lý','Bút','Bộ chuyển đổi điện','Dây sạc']}};
const $=s=>document.querySelector(s);
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmtDate(v){if(!v)return '-'; const d=new Date(v); if(Number.isNaN(d.getTime()))return esc(v); return d.toLocaleString('vi-VN');}
function fmtDay(v){if(!v)return '-'; const [y,m,d]=String(v).split('-'); return y&&m&&d?`${d}/${m}/${y}`:esc(v)}
function deptName(d){return d==='fb'?'F&B':d==='housekeeping'?'Housekeeping':'Lễ tân'}
function statusText(s){return {borrowing:'Đang mượn',partial:'Đã trả một phần',returned:'Đã trả đủ',resolved_issue:'Đã xử lý mất/hỏng'}[s]||s}
function padQty(v){return String(Math.max(1,Number(v)||1)).padStart(2,'0')}
const ITEM_I18N={
  'ly thủy tinh':{en:'Glass',zh:'玻璃杯',ko:'유리컵'},'ly rượu vang':{en:'Wine glass',zh:'红酒杯',ko:'와인잔'},'tách cà phê':{en:'Coffee cup',zh:'咖啡杯',ko:'커피잔'},
  'muỗng':{en:'Spoon',zh:'勺子',ko:'숟가락'},'nĩa':{en:'Fork',zh:'叉子',ko:'포크'},'dao ăn':{en:'Table knife',zh:'餐刀',ko:'테이블 나이프'},'dao':{en:'Knife',zh:'刀',ko:'칼'},
  'đĩa':{en:'Plate',zh:'盘子',ko:'접시'},'tô':{en:'Bowl',zh:'碗',ko:'그릇'},'khay':{en:'Tray',zh:'托盘',ko:'쟁반'},'xô đá':{en:'Ice bucket',zh:'冰桶',ko:'얼음통'},
  'bình nước':{en:'Water jug',zh:'水壶',ko:'물병'},'dụng cụ mở rượu':{en:'Wine opener',zh:'开瓶器',ko:'와인 오프너'},
  'bàn ủi':{en:'Iron',zh:'熨斗',ko:'다리미'},'cầu là':{en:'Ironing board',zh:'熨衣板',ko:'다리미판'},'móc áo':{en:'Clothes hanger',zh:'衣架',ko:'옷걸이'},
  'gối':{en:'Pillow',zh:'枕头',ko:'베개'},'chăn':{en:'Blanket',zh:'毯子',ko:'담요'},'khăn tắm':{en:'Bath towel',zh:'浴巾',ko:'목욕 수건'},'khăn mặt':{en:'Face towel',zh:'面巾',ko:'세면 수건'},
  'máy sấy tóc':{en:'Hair dryer',zh:'吹风机',ko:'헤어드라이어'},'ổ cắm nối dài':{en:'Extension cord',zh:'延长线插座',ko:'연장선'},'nôi em bé':{en:'Baby cot',zh:'婴儿床',ko:'아기 침대'},'ghế em bé':{en:'Baby chair',zh:'儿童椅',ko:'아기 의자'},
  'ô / dù':{en:'Umbrella',zh:'雨伞',ko:'우산'},'ô':{en:'Umbrella',zh:'雨伞',ko:'우산'},'dù':{en:'Umbrella',zh:'雨伞',ko:'우산'},'adapter':{en:'Adapter',zh:'转换插头',ko:'어댑터'},
  'sạc điện thoại':{en:'Phone charger',zh:'手机充电器',ko:'휴대폰 충전기'},'ổ cắm':{en:'Power socket',zh:'插座',ko:'콘센트'},'kéo':{en:'Scissors',zh:'剪刀',ko:'가위'},
  'cân hành lý':{en:'Luggage scale',zh:'行李秤',ko:'수하물 저울'},'bút':{en:'Pen',zh:'笔',ko:'펜'},'bộ chuyển đổi điện':{en:'Power adapter',zh:'电源转换器',ko:'전원 어댑터'},'dây sạc':{en:'Charging cable',zh:'充电线',ko:'충전 케이블'}
};
function itemKey(v){return String(v||'').trim().toLocaleLowerCase('vi-VN').replace(/\s+/g,' ')}
function translateItem(v,lang){const raw=String(v||'').trim();if(!raw||lang==='vi')return raw;const c=catalogItems.find(x=>itemKey(x.name_vi)===itemKey(raw));if(c){const k=lang==='en'?'name_en':lang==='zh'?'name_zh':'name_ko';if(c[k])return c[k]}return ITEM_I18N[itemKey(raw)]?.[lang]||raw}

const RECEIPT_TEXT={
  vi:{title:'PHIẾU XÁC NHẬN MƯỢN ĐỒ',code:'MÃ PHIẾU',guest:'Khách',room:'Phòng',department:'Bộ phận',item:'Đồ mượn',qty:'Số lượng',staff:'Nhân viên giao',borrowed:'Thời gian giao',expected:'Dự kiến trả',notes:'Ghi chú',photo:'Ảnh đồ mượn',rulesTitle:'XÁC NHẬN & QUY ĐỊNH MƯỢN ĐỒ',rule:(q,item)=>`Tôi xác nhận đã nhận thêm ${padQty(q)} ${item} từ Sao Mai Phu My Resort. Tôi có trách nhiệm bảo quản và hoàn trả ${item} khi sử dụng xong. Nếu làm mất, làm hỏng hoặc không hoàn trả, tôi đồng ý thanh toán phí bồi thường theo quy định của Sao Mai Phu My Resort.`,guestSign:'KHÁCH XÁC NHẬN',staffSign:'NHÂN VIÊN GIAO',signNote:'Ký và ghi rõ họ tên',place:'Phú Mỹ'},
  en:{title:'BORROWED ITEM CONFIRMATION',code:'RECEIPT CODE',guest:'Guest',room:'Room',department:'Department',item:'Borrowed item',qty:'Quantity',staff:'Staff handing over',borrowed:'Hand-over time',expected:'Expected return',notes:'Notes',photo:'Borrowed item photo',rulesTitle:'CONFIRMATION & BORROWING TERMS',rule:(q,item)=>`I confirm that I have received ${padQty(q)} ${item} from Sao Mai Phu My Resort. I am responsible for keeping the item(s) in good condition and returning them after use. In case of loss, damage, or failure to return the item(s), I agree to pay the applicable compensation fee in accordance with Sao Mai Phu My Resort's regulations.`,guestSign:'GUEST CONFIRMATION',staffSign:'STAFF HANDING OVER',signNote:'Signature and full name',place:'Phu My'},
  zh:{title:'借用物品确认单',code:'确认单编号',guest:'客人姓名',room:'房号',department:'部门',item:'借用物品',qty:'数量',staff:'交付员工',borrowed:'交付时间',expected:'预计归还',notes:'备注',photo:'借用物品照片',rulesTitle:'确认与借用规定',rule:(q,item)=>`本人确认已从 Sao Mai Phu My Resort 领取 ${padQty(q)} 件 ${item}。本人有责任妥善保管并在使用完毕后归还该物品。如发生遗失、损坏或未归还的情况，本人同意按照 Sao Mai Phu My Resort 的规定支付相应赔偿费用。`,guestSign:'客人确认',staffSign:'交付员工',signNote:'签名并填写姓名',place:'富美'},
  ko:{title:'대여 물품 확인서',code:'확인서 번호',guest:'고객명',room:'객실',department:'부서',item:'대여 물품',qty:'수량',staff:'인계 직원',borrowed:'인계 시간',expected:'예상 반납일',notes:'비고',photo:'대여 물품 사진',rulesTitle:'확인 및 대여 규정',rule:(q,item)=>`본인은 Sao Mai Phu My Resort로부터 ${padQty(q)}개의 ${item}을 수령했음을 확인합니다. 본인은 해당 물품을 안전하게 보관하고 사용 후 반납할 책임이 있습니다. 분실, 파손 또는 미반납 시 Sao Mai Phu My Resort의 규정에 따른 배상금을 지불하는 데 동의합니다.`,guestSign:'고객 확인',staffSign:'인계 직원',signNote:'서명 및 성명',place:'푸미'}
};

async function loadCatalog(){const r=await fetch(`/api/items?department=${encodeURIComponent(dept)}`);const j=await r.json();if(!r.ok)throw new Error(j.error||'Không tải được danh mục');catalogItems=j.items||[];const sel=$('#itemName');const current=sel.value;sel.innerHTML='<option value="">-- Chọn đồ mượn --</option>'+catalogItems.map(x=>`<option value="${esc(x.name_vi)}">${esc(x.name_vi)}</option>`).join('');if(catalogItems.some(x=>x.name_vi===current))sel.value=current;updateRegulationPreview();}
async function renderDept(){const d=DEPTS[dept]; $('#deptEyebrow').textContent=d.eyebrow;$('#deptTitle').textContent=d.title;document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.dept===dept));try{await loadCatalog()}catch(e){console.error(e);const sel=$('#itemName');sel.innerHTML='<option value="">-- Chọn đồ mượn --</option>'+d.items.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}updateRegulationPreview();if(manageOpen)loadRows();if(!$('#catalogManager').classList.contains('hidden'))loadCatalogManager();}
function updateRegulationPreview(){const form=$('#loanForm');const q=form.qty?.value||1;const raw=form.item_name?.value.trim()||'đồ dùng';const lang=$('#receiptLang').value||'vi';const item=translateItem(raw,lang);$('#regulationPreview').textContent=RECEIPT_TEXT[lang].rule(q,item)}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{dept=b.dataset.dept;renderDept()});
$('#loanForm').addEventListener('input',e=>{if(['qty','item_name','receipt_lang'].includes(e.target.name))updateRegulationPreview()});
$('#receiptLang').onchange=updateRegulationPreview;$('#itemName').onchange=updateRegulationPreview;


function openItemModal(){const f=$('#itemForm');f.reset();f.pin.value=adminPin||'';$('#itemModal').classList.remove('hidden');setTimeout(()=>f.name_vi.focus(),50)}
function closeItemModal(){$('#itemModal').classList.add('hidden')}
$('#addItemBtn').onclick=openItemModal;$('#closeItemModal').onclick=closeItemModal;$('#cancelItemModal').onclick=closeItemModal;$('#itemModal').onclick=e=>{if(e.target.id==='itemModal')closeItemModal()};
$('#autoTranslateBtn').onclick=async()=>{
  const f=$('#itemForm'),name_vi=f.name_vi.value.trim(),pin=f.pin.value.trim(),btn=$('#autoTranslateBtn'),st=$('#translateStatus');
  if(!name_vi)return alert('Nhập tên tiếng Việt trước khi dịch.');
  if(!pin)return alert('Nhập PIN quản lý để sử dụng tự động dịch.');
  btn.disabled=true;btn.textContent='Đang dịch…';st.textContent='Workers AI đang dịch sang EN / 中文 / 한국어…';
  try{
    const r=await fetch('/api/translate-item',{method:'POST',headers:{'content-type':'application/json','x-admin-pin':pin},body:JSON.stringify({name_vi})});
    const j=await r.json();if(!r.ok)throw new Error(j.error||'Không dịch được');
    f.name_en.value=j.name_en||'';f.name_zh.value=j.name_zh||'';f.name_ko.value=j.name_ko||'';adminPin=pin;
    st.textContent='✓ Đã tự động dịch. Có thể chỉnh lại nếu cần trước khi lưu.';
  }catch(e){st.textContent='Không dịch được: '+e.message;alert(e.message)}
  finally{btn.disabled=false;btn.textContent='✨ Tự động dịch'}
};
$('#itemForm').onsubmit=async e=>{e.preventDefault();const f=e.target,pin=f.pin.value.trim();if(!pin)return alert('Nhập PIN quản lý');const body={department:dept,name_vi:f.name_vi.value.trim(),name_en:f.name_en.value.trim(),name_zh:f.name_zh.value.trim(),name_ko:f.name_ko.value.trim()};const submit=e.submitter;if(submit){submit.disabled=true;submit.textContent='Đang lưu…'}try{const r=await fetch('/api/items',{method:'POST',headers:{'content-type':'application/json','x-admin-pin':pin},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw new Error(j.error||'Không thêm được đồ');adminPin=pin;closeItemModal();await loadCatalog();$('#itemName').value=j.item?.name_vi||body.name_vi;updateRegulationPreview();alert(`${j.restored?'Đã khôi phục món cũ và cập nhật bản dịch.':'Đã thêm vào danh mục.'}\nEN: ${j.item?.name_en||''}\n中文: ${j.item?.name_zh||''}\n한국어: ${j.item?.name_ko||''}`);if(!$('#catalogManager').classList.contains('hidden'))loadCatalogManager();}catch(err){alert(err.message)}finally{if(submit){submit.disabled=false;submit.textContent='Lưu vào danh mục'}}};
$('#catalogManageBtn').onclick=()=>{$('#catalogManager').classList.remove('hidden');loadCatalogManager()};$('#closeCatalogManager').onclick=()=>$('#catalogManager').classList.add('hidden');
async function loadCatalogManager(){try{await loadCatalog();$('#catalogDeptName').textContent=deptName(dept);$('#catalogRows').innerHTML=catalogItems.map(x=>`<div class="catalog-row"><b>${esc(x.name_vi)}</b><span>${esc(x.name_en||'—')}</span><span>${esc(x.name_zh||'—')}</span><span>${esc(x.name_ko||'—')}</span><div class="catalog-actions"><button class="secondary" onclick="editCatalog(${x.id})">Sửa</button><button class="danger" onclick="deleteCatalog(${x.id})">Xóa</button></div></div>`).join('')||'<div>Chưa có danh mục.</div>'}catch(e){alert(e.message)}}
window.editCatalog=async id=>{const x=catalogItems.find(v=>Number(v.id)===Number(id));if(!x)return;const pin=adminPin||prompt('PIN quản lý');if(!pin)return;const name_vi=prompt('Tên tiếng Việt',x.name_vi);if(name_vi===null)return;const name_en=prompt('English',x.name_en||'');if(name_en===null)return;const name_zh=prompt('中文',x.name_zh||'');if(name_zh===null)return;const name_ko=prompt('한국어',x.name_ko||'');if(name_ko===null)return;const r=await fetch(`/api/items/${id}`,{method:'PATCH',headers:{'content-type':'application/json','x-admin-pin':pin},body:JSON.stringify({department:dept,name_vi,name_en,name_zh,name_ko})});const j=await r.json();if(!r.ok)return alert(j.error||'Không sửa được');adminPin=pin;await loadCatalogManager()};
window.deleteCatalog=async id=>{if(!confirm('Xóa đồ này khỏi danh mục? Các phiếu cũ vẫn giữ nguyên.'))return;const pin=adminPin||prompt('PIN quản lý');if(!pin)return;const r=await fetch(`/api/items/${id}`,{method:'DELETE',headers:{'x-admin-pin':pin}});const j=await r.json();if(!r.ok)return alert(j.error||'Không xóa được');adminPin=pin;await loadCatalogManager()};

$('#loanImage').onchange=()=>{const f=$('#loanImage').files[0];const box=$('#imagePreview');box.innerHTML='';box.classList.add('hidden');if(!f)return;if(f.size>5*1024*1024){$('#loanImage').value='';return alert('Ảnh tối đa 5MB. Vui lòng chọn ảnh nhỏ hơn.')}if(!/^image\/(jpeg|png|webp|gif)$/i.test(f.type)){ $('#loanImage').value=''; return alert('Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF.'); }const url=URL.createObjectURL(f);box.innerHTML=`<img src="${url}" alt="Xem trước"><span>${esc(f.name)} · ${(f.size/1024/1024).toFixed(2)} MB</span>`;box.classList.remove('hidden')};

$('#loanForm').onsubmit=async e=>{
  e.preventDefault();
  const fd=new FormData(e.target);
  fd.set('department',dept);
  const f=fd.get('image');
  if(f instanceof File && f.size>5*1024*1024)return alert('Ảnh tối đa 5MB.');
  const btn=e.submitter; if(btn)btn.disabled=true;
  try{
    const r=await fetch('/api/loans',{method:'POST',body:fd});
    const j=await r.json();
    if(!r.ok)return alert(j.error||'Không tạo được phiếu');
    lastReceipt=j.row; lastReceiptLang=fd.get('receipt_lang')||'vi';
    $('#createResult').innerHTML=`<div class="result-ok"><b>Đã tạo phiếu ${esc(j.code)}</b> · ${deptName(dept)} · Phòng ${esc(j.row.room_no)} · ${esc(j.row.qty)} × ${esc(j.row.item_name)}</div>`;
    renderReceipt(lastReceipt,lastReceiptLang);
    $('#receiptSection').classList.remove('hidden');
    $('#receiptSection').scrollIntoView({behavior:'smooth',block:'start'});
    e.target.reset(); e.target.qty.value=1; $('#receiptLang').value='vi'; await loadCatalog(); $('#imagePreview').innerHTML=''; $('#imagePreview').classList.add('hidden'); updateRegulationPreview();
    if(manageOpen)loadRows();
  }finally{if(btn)btn.disabled=false;}
};

function renderReceipt(row,lang){
  if(!row)return; lastReceiptLang=lang; const t=RECEIPT_TEXT[lang]||RECEIPT_TEXT.vi; const translatedItem=translateItem(row.item_name,lang);
  document.querySelectorAll('.lang-btn').forEach(b=>b.classList.toggle('active',b.dataset.lang===lang));
  const image=row.image_url?`<div class="receipt-photo"><div class="receipt-label">${esc(t.photo)}</div><img src="${esc(row.image_url)}" alt="${esc(row.item_name)}"></div>`:'';
  const now=new Date(row.created_at); const dateText=Number.isNaN(now.getTime())?esc(row.created_at):now.toLocaleString(lang==='vi'?'vi-VN':lang==='zh'?'zh-CN':lang==='ko'?'ko-KR':'en-GB');
  const expected=fmtDay(row.expected_return_date);
  $('#receipt').innerHTML=`
    <div class="receipt-head"><img src="/sao-mai-logo.jpg" alt="Logo"><div><h2>${esc(t.title)}</h2><p>SAO MAI PHU MY RESORT · PHÚ MỸ, VIỆT NAM</p></div></div>
    <div class="receipt-code"><span>${esc(t.code)}</span><b>${esc(row.code)}</b></div>
    <div class="receipt-info">
      <div><span>${esc(t.guest)}</span><b>${esc(row.guest_name)}</b></div><div><span>${esc(t.room)}</span><b>${esc(row.room_no)}</b></div>
      <div><span>${esc(t.department)}</span><b>${esc(deptName(row.department))}</b></div><div><span>${esc(t.staff)}</span><b>${esc(row.staff_name||'-')}</b></div>
      <div><span>${esc(t.item)}</span><b>${esc(translatedItem)}</b></div><div><span>${esc(t.qty)}</span><b>${esc(row.qty)}</b></div>
      <div><span>${esc(t.borrowed)}</span><b>${dateText}</b></div><div><span>${esc(t.expected)}</span><b>${expected}</b></div>
      ${row.notes?`<div class="receipt-wide"><span>${esc(t.notes)}</span><b>${esc(row.notes)}</b></div>`:''}
    </div>
    ${image}
    <div class="receipt-rules"><h3>${esc(t.rulesTitle)}</h3><p>${esc(t.rule(row.qty,translatedItem))}</p></div>
    <div class="receipt-date">${esc(t.place)}, ${new Date(row.created_at).toLocaleDateString(lang==='vi'?'vi-VN':lang==='zh'?'zh-CN':lang==='ko'?'ko-KR':'en-GB')}</div>
    <div class="receipt-signatures"><div><b>${esc(t.guestSign)}</b><span>${esc(t.signNote)}</span><i></i></div><div><b>${esc(t.staffSign)}</b><span>${esc(t.signNote)}</span><i></i></div></div>`;
}
document.querySelectorAll('.lang-btn').forEach(b=>b.onclick=()=>{if(lastReceipt)renderReceipt(lastReceipt,b.dataset.lang)});
$('#printReceipt').onclick=()=>window.print();
$('#newReceipt').onclick=()=>{$('#receiptSection').classList.add('hidden');$('#loanForm').scrollIntoView({behavior:'smooth'})};

$('#openManage').onclick=()=>{adminPin=$('#adminPin').value.trim();if(!adminPin)return alert('Nhập PIN quản lý');manageOpen=true;$('#manageArea').classList.remove('hidden');loadRows()};
$('#refreshBtn').onclick=loadRows;$('#searchQ').oninput=()=>{clearTimeout(window._qt);window._qt=setTimeout(loadRows,250)};$('#statusFilter').onchange=loadRows;
async function loadRows(){const q=$('#searchQ').value.trim(),st=$('#statusFilter').value;const u=new URL('/api/loans',location.origin);u.searchParams.set('department',dept);if(q)u.searchParams.set('q',q);if(st)u.searchParams.set('status',st);const r=await fetch(u,{headers:{'x-admin-pin':adminPin}});const j=await r.json();if(!r.ok){manageOpen=false;$('#manageArea').classList.add('hidden');return alert(j.error||'Không mở được danh sách')}const rows=j.rows||[];$('#stOpen').textContent=rows.filter(x=>x.remaining_qty>0).length;$('#stItems').textContent=rows.reduce((a,x)=>a+x.remaining_qty,0);$('#stReturned').textContent=rows.filter(x=>x.status==='returned').length;$('#stIssue').textContent=rows.filter(x=>x.status==='resolved_issue').length;$('#loanRows').innerHTML=rows.map(rowHtml).join('')||'<tr><td colspan="10">Chưa có dữ liệu.</td></tr>'}
function rowHtml(r){const img=r.image_url?`<a href="${esc(r.image_url)}" target="_blank" class="thumb-link"><img src="${esc(r.image_url)}" class="thumb" alt="Ảnh"></a>`:'<span class="no-photo">—</span>';return `<tr><td>${img}</td><td><b>${esc(r.code)}</b><br><small>${esc(deptName(r.department))}</small></td><td><b>${esc(r.guest_name)}</b><br>Phòng ${esc(r.room_no)}${r.staff_name?`<br><small>NV: ${esc(r.staff_name)}</small>`:''}</td><td>${esc(r.item_name)}${r.notes?`<br><small>${esc(r.notes)}</small>`:''}</td><td>${r.qty}<br><small>Trả ${r.returned_qty} · Mất ${r.lost_qty} · Hỏng ${r.damaged_qty}</small></td><td><b>${r.remaining_qty}</b></td><td>${fmtDate(r.created_at)}</td><td>${fmtDay(r.expected_return_date)}</td><td><span class="badge ${esc(r.status)}">${esc(statusText(r.status))}</span></td><td><div class="row-actions">${r.remaining_qty>0?`<button class="secondary" onclick="act(${r.id},'return_one')">Trả 1</button><button class="secondary" onclick="act(${r.id},'return_all')">Trả hết</button><button class="warn" onclick="act(${r.id},'lost_one')">Mất 1</button><button class="warn" onclick="act(${r.id},'damaged_one')">Hỏng 1</button>`:''}<button class="secondary" onclick="printLoan(${r.id})">Phiếu</button><button class="danger" onclick="delLoan(${r.id})">Xóa</button></div></td></tr>`}
window.act=async(id,action)=>{if(['lost_one','damaged_one'].includes(action)&&!confirm('Xác nhận thao tác này?'))return;const r=await fetch(`/api/loans/${id}`,{method:'PATCH',headers:{'content-type':'application/json','x-admin-pin':adminPin},body:JSON.stringify({action})});const j=await r.json();if(!r.ok)return alert(j.error||'Có lỗi');loadRows()};
window.delLoan=async id=>{if(!confirm('Chỉ xóa khi phiếu tạo sai. Xác nhận xóa?'))return;const r=await fetch(`/api/loans/${id}`,{method:'DELETE',headers:{'x-admin-pin':adminPin}});const j=await r.json();if(!r.ok)return alert(j.error||'Có lỗi');loadRows()};
window.printLoan=async id=>{const r=await fetch(`/api/loans/${id}`,{headers:{'x-admin-pin':adminPin}});const j=await r.json();if(!r.ok)return alert(j.error||'Không mở được phiếu');lastReceipt=j.row;renderReceipt(lastReceipt,'vi');$('#receiptSection').classList.remove('hidden');$('#receiptSection').scrollIntoView({behavior:'smooth'})};
$('#checkoutBtn').onclick=async()=>{const room=$('#checkoutRoom').value.trim(),pin=$('#checkoutPin').value.trim();if(!room||!pin)return alert('Nhập số phòng và PIN quản lý');const r=await fetch(`/api/checkout?room=${encodeURIComponent(room)}`,{headers:{'x-admin-pin':pin}});const j=await r.json();if(!r.ok)return alert(j.error||'Không kiểm tra được');if(j.clear){$('#checkoutResult').innerHTML=`<div class="check-ok"><b>✓ PHÒNG ${esc(room)}: KHÔNG CÒN ĐỒ CHƯA TRẢ</b><br>Có thể tiếp tục quy trình checkout.</div>`}else{$('#checkoutResult').innerHTML=`<div class="check-alert"><b>⚠ PHÒNG ${esc(room)} CÒN ${j.open.reduce((a,x)=>a+x.remaining_qty,0)} MÓN CHƯA THU HỒI</b><div class="check-list">${j.open.map(x=>`<div class="check-item">${x.image_url?`<img src="${esc(x.image_url)}" class="checkout-thumb" alt="Ảnh">`:''}<span><b>${esc(deptName(x.department))}</b> · ${esc(x.item_name)} · còn <b>${x.remaining_qty}</b> · mã ${esc(x.code)}</span></div>`).join('')}</div></div>`}};
renderDept();
