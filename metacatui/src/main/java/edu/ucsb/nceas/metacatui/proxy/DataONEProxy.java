package edu.ucsb.nceas.metacatui.proxy;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.charset.Charset;

import javax.servlet.Servlet;
import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.commons.io.IOUtils;

/**
 * A proxy class that passes requests from the client through to the appropriate DataONE
 * service endpoint. This class is used to provide a single point of communication
 * for clients even when a client may want to communicate with multiple service providers
 * but is prevented from doing so due to the single origin policy for web clients.
 */
public class DataONEProxy extends HttpServlet {
	private static final long serialVersionUID = 1L;

    /**
     * Default constructor. 
     */
    public DataONEProxy() {
        // TODO Auto-generated constructor stub
    }

	/**
	 * @see Servlet#init(ServletConfig)
	 */
	public void init(ServletConfig config) throws ServletException {
	    System.out.println("DataONE proxy servlet starting...");
	}

	/**
	 * @see HttpServlet#doGet(HttpServletRequest request, HttpServletResponse response)
	 */
	protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
	    System.out.println(request.getRequestURI());
		response.setContentType("application/json");
	    response.getWriter().write(proxyQuery(request.getParameter("start")));
	}

	/**
	 * @see HttpServlet#doPost(HttpServletRequest request, HttpServletResponse response)
	 */
	protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		// TODO Auto-generated method stub
	}

	/**
	 * @see HttpServlet#doPut(HttpServletRequest, HttpServletResponse)
	 */
	protected void doPut(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		// TODO Auto-generated method stub
	}

	/**
	 * @see HttpServlet#doDelete(HttpServletRequest, HttpServletResponse)
	 */
	protected void doDelete(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		// TODO Auto-generated method stub
	}

	private String proxyQuery(String start) {
	    String result="";
	    /*
	    InputStream is = null;
	    try {
            URI query = new URI("https://cn.dataone.org/cn/v1/query/solr/fl=id,title,origin,pubDate,abstract&q=formatType:METADATA+-obsoletedBy:*&rows=15&start=30&wt=json");
            URL url = query.toURL();
            is = url.openStream();
            result = IOUtils.toString(is, Charset.forName("UTF-8"));
        } catch (URISyntaxException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        } catch (IOException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        } finally {
            try {
                is.close();
            } catch (IOException e) {
                // TODO Auto-generated catch block
                e.printStackTrace();
            }
        }
        return result;
	    */
	    return simulateSearchResults(start);
	}
	
	private String simulateSearchResults(String start) {
	    String updatedSimData = "";
	    //InputStream is = this.getClass().getResourceAsStream("/simulated-data.json");
	    InputStream is = this.getClass().getResourceAsStream("/solr-data.json");
	    try {
	        String updatedYear = 2012 + start;
            String simData = IOUtils.toString(is, Charset.forName("UTF-8"));
            // change the result start record number
            System.out.println("Start is: " + start);
            updatedSimData = simData.replaceAll("\"start\":\"0\"", "\"start\":\"" + start + "\"").replaceAll("\"start\":0", "\"start\":" + start).replaceAll("2012", updatedYear);
        } catch (IOException e) {
            e.printStackTrace();
        }
	    return updatedSimData;
	}
}
