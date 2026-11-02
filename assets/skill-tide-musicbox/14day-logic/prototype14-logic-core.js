const TideTrial = ((model) => {
  function initial(context) {
    return model.initial(context);
  }

  function act(context, draft, action) {
    switch (action.type) {
      case 'select': return model.select(context, draft, action.day, action.offset, 30);
      case 'mapping': return model.validate(context, {...draft, mapping: action.value});
      case 'edit': return model.edit(context, draft, action.index, {shift: action.shift, volume: action.volume});
      case 'place': return model.place(context, draft, action.slot);
      case 'reopen': return model.reopen(context, draft, action.slot);
      case 'reset': return initial(context);
      default: throw new Error('未知操作');
    }
  }

  function compare(context, draft) {
    return {
      old: model.events(context, draft.working, {...draft, mapping: 'height'}),
      new: model.events(context, draft.working, {...draft, mapping: 'contour'}),
    };
  }

  function rejectInjectedQuality(source) {
    const injected = source.map((record, index) => index === 0 ? {...record, q: 'p'} : record);
    return model.prepare(injected);
  }

  return {initial, act, compare, rejectInjectedQuality};
})(typeof module !== 'undefined' && module.exports ? require('../tide14-model.js') : Tide14);

if (typeof module !== 'undefined' && module.exports) module.exports = TideTrial;
