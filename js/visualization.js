(function() {
  var Client, CodeMirrorAdapter, MyClient, MyServer, NetworkChannel, Server, JSONPatchOperation, View, Visualization, WrappedOperation, createOperationElement, hideSpan, highlight, operationPopoverContent, operationToHtml, stateTransitions, tr,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Client = ot.Client;

  Server = ot.Server;

  JSONPatchOperation = ot.JSONPatchOperation;

  WrappedOperation = ot.WrappedOperation;

  CodeMirrorAdapter = ot.CodeMirrorAdapter;

  View = {
    appendTo: function(el) {
      this.el.appendTo(el);
      return this;
    }
  };

  operationToHtml = function(operation) {
    return "<span>"+
            JSON.stringify(operation) +
        "</span>";
  };

  operationPopoverContent = function(operation) {
    return function() {
      return ['<table class="table table-condensed table-noheader">', tr("Author", operation.meta.creator), typeof operation.revision === 'number' ? tr("Revision", operation.revision) : '', tr("Changeset", operationToHtml(operation.wrapped)), '</table>'].join('\n');
    };
  };

  createOperationElement = function(operation) {
    return $('<span class="operation" title="Operation" />').addClass('operation' + operation.meta.id).attr({
      'data-operation-id': operation.meta.id
    }).addClass(operation.meta.creator.toLowerCase());
  };

  Visualization = (function() {

    function Visualization(json) {
      var clientReceive, serverReceive,
        _this = this;
      this.json = json;
      this.el = $('<div id="visualization" />').delegate('.operation', {
        mouseenter: function() {
          var operationId;
          operationId = $(this).attr('data-operation-id');
          return $('.operation' + operationId).addClass('same-operation');
        },
        mouseleave: function() {
          return $('.same-operation').removeClass('same-operation');
        }
      });
      serverReceive = function(o) {
        var oPrime;
        oPrime = _this.server.receiveOperation(o.revision, o);
        delete o.revision;
        _this.server.appendToHistory(oPrime);
        _this.aliceReceiveChannel.write(oPrime);
        return _this.bobReceiveChannel.write(oPrime);
      };
      clientReceive = function(client) {
        return function(o) {
          if (o.meta.creator === client.name) {
            return client.serverAck();
          } else {
            return client.applyServer(o);
          }
        };
      };
      this.server = new MyServer(json).appendTo(this.el);
      this.aliceSendChannel = new NetworkChannel(true, serverReceive).appendTo(this.el);
      this.aliceSendChannel.el.attr({
        id: 'alice-send-channel'
      });
      this.alice = new MyClient(
        "Alice (browser)", //name
        cloneJSON(json), //document
        0,0, //state
        "_ClientVersion$","ServerVersion", //revision property names
        this.aliceSendChannel //networking channel
      ).appendTo(this.el);
      this.alice.el.attr({
        id: 'alice'
      });
      this.alice.diagram.setAttribute('id', 'alice-diamond-diagram');
      this.aliceReceiveChannel = new NetworkChannel(false, clientReceive(this.alice)).appendTo(this.el);
      this.aliceReceiveChannel.el.attr({
        id: 'alice-receive-channel'
      });
      this.bobSendChannel = new NetworkChannel(true, serverReceive).appendTo(this.el);
      this.bobSendChannel.el.attr({
        id: 'bob-send-channel'
      });
      this.bob = new MyClient(
        "Bob (SC Server)", 
        cloneJSON(json), 
        0,0,
        "ServerVersion","_ClientVersion$", //revision property names
        this.bobSendChannel
      ).appendTo(this.el);
      this.bob.el.attr({
        id: 'bob'
      });
      this.bob.diagram.setAttribute('id', 'bob-diamond-diagram');
      this.bobReceiveChannel = new NetworkChannel(false, clientReceive(this.bob)).appendTo(this.el);
      this.bobReceiveChannel.el.attr({
        id: 'bob-receive-channel'
      });
    }

    Visualization.prototype.attached = function() {
      return this;
    };

    return Visualization;

  })();

  window.Visualization = Visualization;



  NetworkChannel = (function() {

    function NetworkChannel(up, onReceive) {
      var arrow,
        _this = this;
      this.up = up;
      this.onReceive = onReceive;
      this.buffer = [];
      this.els = [];
      this.el = $('<div class="network-channel"><div class="connection" /></div>').addClass(this.up ? 'up-channel' : 'down-channel');
      arrow = this.up ? '&uarr;' : '&darr;';
      this.button = $('<a href="#" class="disabled">' + arrow + '</a>').appendTo(this.el).click(function(e) {
        if (!_this.button.hasClass('disabled')) {
          _this.receive();
        }
        return false;
      });
    }

    NetworkChannel.prototype.write = function(val) {
      if (this.buffer.length === 0) {
        this.button.removeClass('disabled');
      }
      this.buffer.push(val);
      return this.els.push(this.createElement(val));
    };

    NetworkChannel.prototype.read = function() {
      if (this.buffer.length === 1) {
        this.button.addClass('disabled');
      }
      this.removeElement(this.els.shift());
      return this.buffer.shift();
    };

    NetworkChannel.prototype.createElement = function(operation) {
      var finished,
        _this = this;
      _.defer(function() {
        return _this.distributeElements();
      });
      this.el.css('overflow', 'hidden');
      finished = function() {
        return _this.el.css('overflow', 'visible');
      };
      setTimeout(finished, 500);
      return createOperationElement(operation).popover({
        trigger: 'hover',
        html: true,
        content: operationPopoverContent(operation)
      }).css(this.up ? {
        top: '150px'
      } : {
        top: '-24px'
      }).appendTo(this.el);
    };

    NetworkChannel.prototype.removeElement = function(el) {
      var remove,
        _this = this;
      el.css(this.up ? {
        top: '-24px'
      } : {
        top: '150px'
      });
      this.el.css('overflow', 'hidden');
      remove = function() {
        el.remove();
        return _this.el.css('overflow', 'visible');
      };
      setTimeout(remove, 500);
      return this.distributeElements();
    };

    NetworkChannel.prototype.distributeElements = function() {
      var el, i, index, partLength, totalHeight, _i, _len, _ref, _results;
      totalHeight = 150;
      partLength = totalHeight / (this.els.length + 1);
      _ref = this.els;
      _results = [];
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        el = _ref[i];
        index = this.up ? i + 1 : this.els.length - i;
        _results.push(el.css({
          top: (Math.floor(index * partLength) - 12) + 'px'
        }));
      }
      return _results;
    };

    NetworkChannel.prototype.receive = function() {
      return this.onReceive.call(null, this.read());
    };

    return NetworkChannel;

  })();

  _.extend(NetworkChannel.prototype, View);

  MyServer = (function(_super) {

    __extends(MyServer, _super);

    function MyServer(doc) {
      MyServer.__super__.constructor.call(this, doc);
      this.el = $('<div id="server" class="well" />');
      $('<h2 />').text("Server (PuppetsOT)").appendTo(this.el);
      this.stateTable = $('<table class="table table-condensed table-noheader" />').html(tr("Content", JSON.stringify(this.document), 'server-content') + tr("History", "", 'server-history')).appendTo(this.el);
    }

    MyServer.prototype.receiveOperation = function(revision, operation) {
      var operationPrime;
      highlight(this.el.find('.server-history .operation').slice(operation.revision));
      operationPrime = MyServer.__super__.receiveOperation.call(this, revision, operation);
      this.el.find('.server-content td').text(JSON.stringify(this.document));
      return operationPrime;
    };

    MyServer.prototype.appendToHistory = function(operation) {
      return this.el.find('.server-history td').append(document.createTextNode(" ")).append(createOperationElement(operation).popover({
        trigger: 'hover',
        html: true,
        content: operationPopoverContent(operation)
      }));
    };

    return MyServer;

  })(Server);

  _.extend(MyServer.prototype, View);

  MyClient = (function(_super) {

    __extends(MyClient, _super);

    function MyClient(name, json, localRevision, revision, localRevPropName, remoteRevPropName, channel) {
      var self, _this = this;
      this.name = name;
      this.channel = channel;
      MyClient.__super__.constructor.call(this, revision);
      this.localRevision = localRevision;
      this.fromServer = false;
      self = this;
      this.el = $('<div class="well client" />').popover({
        selector: '.operation',
        trigger: 'hover',
        html: true,
        content: function() {
          return operationPopoverContent($(this).hasClass('buffer') ? self.state.buffer : self.state.outstanding);
        }
      });
      $('<h2 />').text(this.name).appendTo(this.el);
      this.stateEl = $('<p class="state" />').html("<strong>State:</strong> <span>Synchronized</span>").appendTo(this.el);
      this.editor = document.createElement("juicy-jsoneditor");
      this.editor.json = json;
      this.el.append( this.editor );
      // debugger
      this.editor.addEventListener("change",function(ev){
        var patch = ev.detail.action;
        // debugger
        var operation;
        if (!_this.fromServer) {
          // HERE MAGIC HAPPENDS!
          // change -> operation
          // operation = new WrappedOperation(CodeMirrorAdapter.operationFromCodeMirrorChange(change, _this.cm)[0], {
          _this.localRevision++;
          operation = new WrappedOperation(
            new JSONPatchOperation(
              [patch], 
              _this.localRevision,
              _this.revision,  
              localRevPropName, 
              remoteRevPropName
            ), {
              creator: _this.name,
              id: _.uniqueId('operation')
            }
          );
          console.log(patch, operation);
          return _this.applyClient(operation);
        }        
      });
      // this.initD3();
      this.diagram = document.createElement("juicy-diamond-graph");

      // debugging stuff:
        // revision notifier
        
        var revision_notifier = document.createElement('span');
        revision_notifier.innerHTML = "Acknowledged remote revision:";
        var revNo = document.createTextNode('revision');
        revNo.bind('textContent', new PathObserver(this, 'revision'));
        revision_notifier.appendChild(revNo);
        revision_notifier.appendChild(document.createTextNode(', Local revision: '));
        var remRevNo = document.createTextNode('client');
        remRevNo.bind('textContent', new PathObserver(this, 'localRevision'));
        revision_notifier.appendChild(remRevNo);
        this.el[0].appendChild(revision_notifier);
    }

    MyClient.prototype.appendTo = function(el) {
      View.appendTo.call(this, el);
      $(this.diagram).appendTo(el);
      // el[0].appendChild(this.diagram);
      return this;
    };



    MyClient.prototype.sendOperation = function(revision, operation) {
      operation.revision = revision;
      return this.channel.write(operation);
    };

    MyClient.prototype.applyOperation = function(operation) {
      this.fromServer = true;
      debugger
      return operation.apply(this.editor.json);
      CodeMirrorAdapter.applyOperationToCodeMirror(operation.wrapped, this.cm);
      return this.fromServer = false;
    };

    MyClient.prototype.setAwaitingAndBufferEdge = function(awaitingEdge, bufferEdge) {
      return this.diagram.setAwaitingAndBufferEdge(awaitingEdge, bufferEdge);
    };

    MyClient.prototype.goLeft = function(data) {
      return this.diagram.goLeft(data);
    };

    MyClient.prototype.goRightClient = function(data) {
      return this.diagram.goRightClient(data);
    };

    MyClient.prototype.goRightServer = function(data) {
      return this.diagram.goRightServer(data);
    };

    MyClient.prototype.setState = function(state) {
      var oldState, transition, _i, _len, _results;
      oldState = this.state;
      this.state = state;
      _results = [];
      for (_i = 0, _len = stateTransitions.length; _i < _len; _i++) {
        transition = stateTransitions[_i];
        if (oldState instanceof transition[0] && state instanceof transition[1]) {
          transition[2].call(this);
          break;
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    MyClient.prototype.applyClient = function(operation) {
      this.state.beforeApplyClient(this);
      MyClient.__super__.applyClient.call(this, operation);
      return this.drawAwaitingAndBufferEdges();
    };

    MyClient.prototype.applyServer = function(operation) {
      this.state.beforeApplyServer(this);
      MyClient.__super__.applyServer.call(this, operation);
      return this.drawAwaitingAndBufferEdges();
    };

    MyClient.prototype.serverAck = function() {
      this.state.beforeServerAck(this);
      MyClient.__super__.serverAck.call(this);
      return this.drawAwaitingAndBufferEdges();
    };

    MyClient.prototype.drawAwaitingAndBufferEdges = function() {
      return this.state.drawAwaitingAndBufferEdges(this);
    };

    return MyClient;

  })(Client);

  Client.Synchronized.prototype.beforeApplyClient = function(client) {
    client.goRightClient();
    return client.awaitingLength = 1;
  };

  Client.Synchronized.prototype.beforeApplyServer = function(client) {
    return client.goLeft();
  };

  Client.Synchronized.prototype.beforeServerAck = function() {};

  Client.Synchronized.prototype.drawAwaitingAndBufferEdges = function(client) {
    return client.setAwaitingAndBufferEdge(null, null);
  };

  Client.AwaitingConfirm.prototype.beforeApplyClient = function(client) {
    client.goRightClient();
    return client.bufferLength = 1;
  };

  Client.AwaitingConfirm.prototype.beforeApplyServer = function(client) {
    highlight($('.operation', client.stateEl));
    return client.goLeft();
  };

  Client.AwaitingConfirm.prototype.beforeServerAck = function(client) {
    client.goRightServer({
      length: client.awaitingLength
    });
    return delete client.awaitingLength;
  };

  Client.AwaitingConfirm.prototype.drawAwaitingAndBufferEdges = function(client) {
    return client.setAwaitingAndBufferEdge(client.diagram.serverStatePoint.goRight({
      length: client.awaitingLength
    }), null);
  };

  Client.AwaitingWithBuffer.prototype.beforeApplyClient = function(client) {
    client.bufferLength++;
    client.goRightClient();
    return highlight($('.operation', client.stateEl).eq(1));
  };

  Client.AwaitingWithBuffer.prototype.beforeApplyServer = Client.AwaitingConfirm.prototype.beforeApplyServer;

  Client.AwaitingWithBuffer.prototype.beforeServerAck = function(client) {
    client.goRightServer({
      length: client.awaitingLength
    });
    client.awaitingLength = client.bufferLength;
    return delete client.bufferLength;
  };

  Client.AwaitingWithBuffer.prototype.drawAwaitingAndBufferEdges = function(client) {
    var awaitingEdge, bufferEdge;
    awaitingEdge = client.diagram.serverStatePoint.goRight({
      length: client.awaitingLength
    });
    bufferEdge = awaitingEdge.endPoint.goRight({
      length: client.bufferLength
    });
    return client.setAwaitingAndBufferEdge(awaitingEdge, bufferEdge);
  };

  stateTransitions = [
    [
      Client.Synchronized, Client.AwaitingConfirm, function() {
        return $('> span', this.stateEl).text("Awaiting ").append(createOperationElement(this.state.outstanding).addClass('outstanding')).append(document.createTextNode(" "));
      }
    ], [
      Client.AwaitingConfirm, Client.AwaitingWithBuffer, function() {
        return $('<span>with buffer </span>').append(createOperationElement(this.state.buffer).addClass('buffer')).fadeIn().appendTo(this.stateEl);
      }
    ], [
      Client.AwaitingWithBuffer, Client.AwaitingConfirm, function() {
        var spans;
        spans = $('> span', this.stateEl);
        hideSpan(spans.eq(0));
        spans.get(1).firstChild.data = "Awaiting ";
        spans.eq(1).append(document.createTextNode(" "));
        return createOperationElement(this.state.outstanding).addClass('outstanding').replaceAll($('.operation', this.stateEl).eq(1));
      }
    ], [
      Client.AwaitingConfirm, Client.Synchronized, function() {
        return $('> span', this.stateEl).text("Synchronized");
      }
    ]
  ];

  tr = function(th, td, klass) {
    klass = klass ? ' class="' + klass + '"' : '';
    return "<tr" + klass + "><th>" + th + "</th><td>" + td + "</td></tr>";
  };


  hideSpan = function(span) {
    return span.animate({
      width: 0
    }, 500, function() {
      return span.remove();
    });
  };

  highlight = function(el) {
    el.removeClass('animate').addClass('highlighted');
    return _.defer(function() {
      el.addClass('animate');
      return _.defer(function() {
        return el.removeClass('highlighted');
      });
    });
  };
  function cloneJSON(json){
    return JSON.parse(JSON.stringify(json));
  }

}).call(this);
