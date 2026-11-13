(() => {
  window.AustinMembershipUI={mount(host){
    const M=window.AustinMembership,root=document.createElement('section');
    root.className='membership-card';root.setAttribute('aria-labelledby','membership-heading');
    root.innerHTML=`<h3 id="membership-heading" class="membership-heading" tabindex="-1">Membership</h3>
      <p class="membership-current" role="status">Loading membership…</p>
      <div class="membership-levels"><div><strong>Free</strong><span>$0</span><p>Explore Austin, save your Day Plan, and use Free apps.</p></div>
      <div><strong>Pro</strong><span class="membership-price">$5 / month</span><p class="membership-benefits">Austin 1885, Moontower Walking, the Shopping Apps, and paid access to Austin.chat on Substack.</p></div></div>
      <p class="membership-bundle">Pay on either service for access to both. Use the same email on Austin.chat and <a href="https://austindotchat.substack.com/" target="_blank" rel="noopener">Substack</a>. Cross-service access is activated manually: <a href="/contact/" target="_top">contact us</a> after subscribing. Monthly, annual, and founding paid Substack plans include Pro.</p>
      <p class="membership-detail">Pro renews monthly. Cancel anytime in Manage billing.</p>
      <div class="membership-actions"><button type="button" class="membership-upgrade" disabled>Get Pro — $5/month</button>
      <button type="button" class="membership-manage" hidden>Manage billing</button><button type="button" class="membership-retry" hidden>Try again</button></div>
      <p class="membership-message" role="status" aria-live="polite"></p>`;
    host.append(root);
    const $=name=>root.querySelector('.membership-'+name);
    let open=false,busy=false,run=0;
    function render(state) {
      $('price').textContent=state?.freeTesting?'Free while testing · normally $5/month':'$5 / month';
      $('upgrade').textContent=state?.freeTesting?'Get Pro — Free while testing':'Get Pro — $5/month';
      $('bundle').hidden=!!state?.freeTesting;
      $('benefits').textContent=state?.freeTesting?'Try Austin 1885, Moontower Walking, and the Shopping Apps.':'Austin 1885, Moontower Walking, the Shopping Apps, and paid access to Austin.chat on Substack.';
      $('upgrade').disabled=busy||!state?.checkoutEnabled||state?.plan==='pro';
      $('upgrade').hidden=state?.plan==='pro';$('manage').hidden=!state?.hasBilling;
      $('manage').disabled=busy||!!state?.billingUnavailable;
      if(!state){$('current').textContent='Loading membership…';$('detail').textContent='Pro renews monthly. Cancel anytime in Manage billing.';$('message').textContent='';return;}
      $('current').textContent='Your plan: '+(state.plan==='pro'?'Pro':'Free')+(state.source==='substack'?' — included with Substack':state.temporaryAccess?' — free while testing':'');
      if(state.freeTesting)$('message').textContent='No payment or card required. You will not be charged automatically when testing ends.';
      else if(state.testMode)$('message').textContent='Test billing — no real payments. Test purchases do not unlock live Pro apps.';
      else if(!state.checkoutEnabled&&state.plan!=='pro')$('message').textContent='Pro sign-up is coming soon.';
      else $('message').textContent='';
      if(state.temporaryAccess)$('detail').textContent='Temporary Pro access lasts while free testing is enabled. A paid membership will require a separate checkout.';
      else if(state.plan==='pro'&&state.paidThrough){
        const date=new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(state.paidThrough));
        if(state.source==='substack')$('detail').textContent='Substack access verified through '+date+'. Renewals are updated manually. Manage your subscription on Substack.';
        else if(state.source==='both')$('detail').textContent='Pro is available through '+date+'. You have site billing and verified Substack access. Review your subscriptions to avoid paying twice.';
        else $('detail').textContent=state.cancelAtPeriodEnd?'Pro remains available through '+date+'. Your plan then returns to Free.':'Pro renews monthly. Paid through '+date+'.';
      }else $('detail').textContent=state.freeTesting?'Activate Pro to try the protected apps for free.':'Pro renews monthly. Cancel anytime in Manage billing.';
    }
    async function refresh(){
      const attempt=++run;$('retry').hidden=true;render(M?.state);
      try{const state=await M.load();if(open&&attempt===run)render(state);}
      catch(error){if(open&&attempt===run){$('current').textContent='Membership unavailable';$('message').textContent=error.message;$('retry').hidden=false;}}
    }
    async function action(fn){
      if(busy)return;const attempt=run;busy=true;render(M.state);$('message').textContent=M.state?.freeTesting?'Activating temporary Pro access…':'Opening secure billing…';
      try{await fn();}catch(error){if(open&&attempt===run)$('message').textContent=error.message;}
      finally{busy=false;$('upgrade').disabled=!M.state?.checkoutEnabled||M.state?.plan==='pro';$('manage').disabled=!!M.state?.billingUnavailable;}
    }
    $('upgrade').onclick=()=>action(()=>M.checkout());$('manage').onclick=()=>action(()=>M.manage());$('retry').onclick=refresh;
    M?.subscribe(state=>{if(open){run++;render(state);if(!state&&window.AustinSession?.registered)refresh();}});
    return {async open(){open=true;await refresh();},close(){open=false;run++;},focus(){root.scrollIntoView({block:'nearest'});$('heading').focus?.();}};
  }};
})();
